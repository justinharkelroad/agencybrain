# Stripe 7-Day Free Trial Implementation Plan

## Overview

Implement a 7-day free trial for AgencyBrain using Stripe's native trial functionality. Users provide credit card upfront, get 7 days free, then are automatically charged $299/month.

---

## 1. Stripe Setup

### Create Product & Price in Stripe Dashboard

1. **Product**: "AgencyBrain Pro"
   - Description: "Complete agency management platform"

2. **Price**: $299/month (recurring)
   - Billing period: Monthly
   - Price ID: Save this (e.g., `price_xxxxx`)

### Configure Stripe Settings

- Enable Customer Portal for self-service cancellation
- Set up webhook endpoint (we'll create this)

---

## 2. Database Schema Changes

### New table: `subscriptions`

```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  stripe_customer_id TEXT NOT NULL,
  stripe_subscription_id TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'trialing',
  -- Status values: 'trialing', 'active', 'canceled', 'past_due', 'unpaid'
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for lookups
CREATE INDEX idx_subscriptions_agency_id ON subscriptions(agency_id);
CREATE INDEX idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_stripe_subscription_id ON subscriptions(stripe_subscription_id);

-- RLS Policy
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their agency subscription"
  ON subscriptions FOR SELECT
  USING (agency_id IN (
    SELECT agency_id FROM profiles WHERE id = auth.uid()
  ));
```

### Update `agencies` table (optional shortcut)

```sql
ALTER TABLE agencies
ADD COLUMN stripe_customer_id TEXT,
ADD COLUMN subscription_status TEXT DEFAULT 'none';
-- 'none', 'trialing', 'active', 'canceled', 'past_due'
```

---

## 3. Edge Functions

### 3.1 `create-checkout-session`

Creates a Stripe Checkout session for new signups.

```typescript
// supabase/functions/create-checkout-session/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@13.10.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
})

serve(async (req) => {
  try {
    const { agency_id, email, success_url, cancel_url } = await req.json()

    // Create or retrieve Stripe customer
    let customer
    const existingCustomers = await stripe.customers.list({ email, limit: 1 })

    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0]
    } else {
      customer = await stripe.customers.create({
        email,
        metadata: { agency_id }
      })
    }

    // Create checkout session with 7-day trial
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ['card'],
      line_items: [{
        price: Deno.env.get('STRIPE_PRICE_ID'), // Your $299/month price
        quantity: 1,
      }],
      mode: 'subscription',
      subscription_data: {
        trial_period_days: 7,
        metadata: { agency_id }
      },
      success_url: success_url || `${Deno.env.get('APP_URL')}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancel_url || `${Deno.env.get('APP_URL')}/pricing`,
      metadata: { agency_id }
    })

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
```

### 3.2 `stripe-webhook`

Handles Stripe webhook events to sync subscription status.

```typescript
// supabase/functions/stripe-webhook/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@13.10.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
})

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

serve(async (req) => {
  const signature = req.headers.get('stripe-signature')!
  const body = await req.text()

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      Deno.env.get('STRIPE_WEBHOOK_SECRET')!
    )
  } catch (err) {
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      const agency_id = subscription.metadata.agency_id

      await supabase.from('subscriptions').upsert({
        stripe_subscription_id: subscription.id,
        stripe_customer_id: subscription.customer as string,
        agency_id,
        status: subscription.status,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        trial_start: subscription.trial_start
          ? new Date(subscription.trial_start * 1000).toISOString()
          : null,
        trial_end: subscription.trial_end
          ? new Date(subscription.trial_end * 1000).toISOString()
          : null,
        cancel_at_period_end: subscription.cancel_at_period_end,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'stripe_subscription_id'
      })

      // Also update agency for quick lookups
      await supabase.from('agencies').update({
        stripe_customer_id: subscription.customer as string,
        subscription_status: subscription.status
      }).eq('id', agency_id)

      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription

      await supabase.from('subscriptions').update({
        status: 'canceled',
        canceled_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }).eq('stripe_subscription_id', subscription.id)

      await supabase.from('agencies').update({
        subscription_status: 'canceled'
      }).eq('stripe_customer_id', subscription.customer as string)

      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      // Handle failed payment - send email, show warning in app
      console.log('Payment failed for customer:', invoice.customer)
      break
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
```

### 3.3 `create-customer-portal-session`

Allows users to manage their subscription (cancel, update payment method).

```typescript
// supabase/functions/create-customer-portal-session/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@13.10.0'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
})

serve(async (req) => {
  try {
    const { customer_id, return_url } = await req.json()

    const session = await stripe.billingPortal.sessions.create({
      customer: customer_id,
      return_url: return_url || `${Deno.env.get('APP_URL')}/settings`,
    })

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
```

---

## 4. Frontend Components

### 4.1 Signup Flow (Marketing Page → Stripe Checkout)

```typescript
// src/lib/stripe.ts
export async function createCheckoutSession(agencyId: string, email: string) {
  const response = await fetch('/api/create-checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agency_id: agencyId,
      email,
      success_url: `${window.location.origin}/dashboard?welcome=true`,
      cancel_url: `${window.location.origin}/pricing`,
    }),
  })

  const { url, error } = await response.json()
  if (error) throw new Error(error)

  // Redirect to Stripe Checkout
  window.location.href = url
}
```

### 4.2 Subscription Hook

```typescript
// src/hooks/useSubscription.ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export function useSubscription(agencyId: string | undefined) {
  return useQuery({
    queryKey: ['subscription', agencyId],
    queryFn: async () => {
      if (!agencyId) return null

      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('agency_id', agencyId)
        .single()

      if (error && error.code !== 'PGRST116') throw error
      return data
    },
    enabled: !!agencyId,
  })
}

export function useHasActiveSubscription(agencyId: string | undefined) {
  const { data: subscription } = useSubscription(agencyId)

  return subscription?.status === 'trialing' || subscription?.status === 'active'
}
```

### 4.3 Trial Banner Component

```typescript
// src/components/TrialBanner.tsx
import { useSubscription } from '@/hooks/useSubscription'
import { differenceInDays } from 'date-fns'

export function TrialBanner({ agencyId }: { agencyId: string }) {
  const { data: subscription } = useSubscription(agencyId)

  if (subscription?.status !== 'trialing') return null

  const daysLeft = differenceInDays(
    new Date(subscription.trial_end),
    new Date()
  )

  return (
    <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 mb-4">
      <p className="text-amber-200">
        <strong>{daysLeft} days left</strong> in your free trial.
        Your card will be charged $299/month on {new Date(subscription.trial_end).toLocaleDateString()}.
      </p>
    </div>
  )
}
```

### 4.4 Subscription Gate Component

```typescript
// src/components/SubscriptionGate.tsx
import { useHasActiveSubscription } from '@/hooks/useSubscription'
import { useAuth } from '@/lib/auth'

export function SubscriptionGate({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth()
  const hasAccess = useHasActiveSubscription(profile?.agency_id)

  if (!hasAccess) {
    return <SubscriptionRequired />
  }

  return <>{children}</>
}

function SubscriptionRequired() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8">
      <h2 className="text-2xl font-bold mb-4">Subscription Required</h2>
      <p className="text-muted-foreground mb-6">
        Start your 7-day free trial to access this feature.
      </p>
      <Button onClick={() => window.location.href = '/pricing'}>
        View Pricing
      </Button>
    </div>
  )
}
```

---

## 5. Signup Flow Architecture

### New User Signup Flow:

```
1. User clicks "Start Free Trial" on marketing page
   ↓
2. Show signup form (email, password, agency name)
   ↓
3. Create Supabase auth user
   ↓
4. Create agency record (subscription_status = 'none')
   ↓
5. Call create-checkout-session with agency_id
   ↓
6. Redirect to Stripe Checkout
   ↓
7. User enters credit card, submits
   ↓
8. Stripe creates subscription (status = 'trialing')
   ↓
9. Webhook fires → updates subscriptions table
   ↓
10. User redirected to /dashboard?welcome=true
   ↓
11. Show welcome modal, trial banner visible
```

### Existing User (No Subscription):

```
1. User logs in
   ↓
2. Check subscription status
   ↓
3. If no active subscription, show upgrade prompt
   ↓
4. Click "Start Trial" → Stripe Checkout
   ↓
5. Same flow as above from step 6
```

---

## 6. Environment Variables Needed

Add to Supabase Edge Functions secrets:

```bash
STRIPE_SECRET_KEY=sk_live_xxxxx        # or sk_test_xxxxx for testing
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
STRIPE_PRICE_ID=price_xxxxx            # Your $299/month price ID
APP_URL=https://app.agencybrain.io     # or localhost for dev
```

---

## 7. Stripe Webhook Setup

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://your-project.supabase.co/functions/v1/stripe-webhook`
3. Select events:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
   - `invoice.paid`
4. Copy the webhook signing secret → add to env vars

---

## 8. Implementation Order

### Phase 1: Stripe Setup
- [ ] Create Stripe product and price
- [ ] Set up webhook endpoint in Stripe dashboard
- [ ] Add environment variables to Supabase

### Phase 2: Database
- [ ] Create migration for `subscriptions` table
- [ ] Add columns to `agencies` table
- [ ] Set up RLS policies

### Phase 3: Edge Functions
- [ ] Create `create-checkout-session` function
- [ ] Create `stripe-webhook` function
- [ ] Create `create-customer-portal-session` function
- [ ] Test locally with Stripe CLI

### Phase 4: Frontend - Signup
- [ ] Create signup form component
- [ ] Wire up Stripe checkout redirect
- [ ] Handle success/cancel redirects
- [ ] Create welcome experience for new users

### Phase 5: Frontend - Subscription Management
- [ ] Create `useSubscription` hook
- [ ] Add trial banner component
- [ ] Add subscription gate component
- [ ] Add "Manage Subscription" button in settings

### Phase 6: Testing
- [ ] Test full signup flow with Stripe test mode
- [ ] Test webhook handling
- [ ] Test trial expiration → charge
- [ ] Test cancellation flow
- [ ] Test failed payment handling

---

## 9. Feature Gating Strategy

For the $299/month tier, all current features are included:

| Feature | Trial | Paid |
|---------|-------|------|
| Dashboard & Scorecards | ✅ | ✅ |
| Call Scoring (20/month) | ✅ | ✅ |
| Cancel Audit | ✅ | ✅ |
| Winback HQ | ✅ | ✅ |
| Training Platform | ✅ | ✅ |
| LQS Tracking | ✅ | ✅ |
| Commission Builder | ✅ | ✅ |
| Core 4 | ✅ | ✅ |

Premium features (1-on-1 clients only):
| Feature | Trial | Paid | 1-on-1 |
|---------|-------|------|--------|
| AI Role-Play Bot | ❌ | ❌ | ✅ |
| Quarterly Targets | ❌ | ❌ | ✅ |

---

## 10. Notes

- **Trial doesn't require separate tier** - Stripe handles it natively
- **Credit card required upfront** - Reduces tire-kickers, higher conversion to paid
- **Webhook is source of truth** - Always sync from Stripe, don't trust client
- **Customer Portal** - Let Stripe handle subscription management UI
- **Test mode first** - Use `sk_test_` keys until ready for production
