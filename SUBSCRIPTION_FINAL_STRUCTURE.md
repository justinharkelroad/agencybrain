# AgencyBrain Subscription Structure (Final)

## Pricing Tiers

### 1. AgencyBrain Pro - $299/month
**7-day free trial included**

| Feature | Trial (7 days) | Paid |
|---------|----------------|------|
| **Call Scoring** | 3 calls | 20 calls/month |
| **AI Roleplay** | 2 sessions | Not included |
| **Scorecards** | View/Submit only (default template) | Full customization |
| **Training** | Standard Playbook only | + Manage & Agency Training |
| **Bonus Tool** | Locked | Full access |
| **Call Efficiency Tool** | Locked | Full access |
| **Quarterly Targets** | Locked | Full access |
| **90-Day Audio** | Locked | Full access |
| **Everything Else** | Full access | Full access |

**Need more calls?** Purchase call packs in-app:
- 10 calls - $49
- 25 calls - $99
- 50 calls - $179

---

### 2. 1-on-1 Coaching Client (Manual Toggle)
Everything unlimited:
- Unlimited call scoring
- Unlimited AI roleplay
- All features unlocked

*Set manually by admin for coaching clients*

---

## Database Schema

### Tables Created:

```
agencies
├── stripe_customer_id (new)
└── subscription_status (new): none, trialing, active, canceled, past_due, 1on1_client

subscriptions
├── agency_id
├── stripe_customer_id
├── stripe_subscription_id
├── status
├── trial_start / trial_end
└── current_period_start / current_period_end

feature_limits
├── subscription_status (trialing, active, 1on1_client)
├── feature_key
├── access_type (full, limited, none)
├── usage_limit
└── upgrade_message

feature_usage
├── agency_id
├── feature_key
├── period_start
└── usage_count

agency_call_balance
├── agency_id
├── subscription_calls_used (resets monthly)
├── subscription_calls_limit (3 trial, 20 active, null unlimited)
├── purchased_calls_remaining (never expires)
└── total_calls_used_all_time

call_packs
├── name, description
├── call_count
├── price_cents
└── stripe_price_id

call_pack_purchases
├── agency_id
├── call_pack_id
├── stripe_payment_intent_id
├── call_count, price_cents
└── status
```

---

## Helper Functions

| Function | Purpose |
|----------|---------|
| `check_feature_access(agency_id, feature_key)` | Check if agency can access a feature |
| `increment_feature_usage(agency_id, feature_key)` | Track usage of limited features |
| `check_call_scoring_access(agency_id)` | Get call balance details |
| `use_call_score(agency_id)` | Decrement call balance |
| `add_purchased_calls(agency_id, count)` | Add calls from pack purchase |
| `reset_subscription_calls(agency_id, limit, date)` | Reset monthly allowance |

---

## User Flows

### New User Signup
```
Marketing Page → Click "Start Free Trial"
       ↓
Create Account (email, password, agency name)
       ↓
Stripe Checkout (enter card, 7-day trial)
       ↓
Redirect to Dashboard (status: trialing)
       ↓
Show welcome + trial banner ("6 days left")
```

### Trial → Paid Conversion
```
Day 7: Stripe charges $299
       ↓
Webhook fires → status: active
       ↓
Call balance reset: 20 calls/month
       ↓
All features unlock
```

### Buying More Calls
```
User in Call Scoring → "0 calls remaining"
       ↓
Click "Buy More Calls"
       ↓
Select pack (10/25/50)
       ↓
Stripe Checkout (one-time purchase)
       ↓
Webhook → add_purchased_calls()
       ↓
Calls available immediately
```

### Hitting Feature Limit
```
User clicks "Manage Training" during trial
       ↓
FeatureGate checks access → blocked
       ↓
Show UpgradeModal:
  "Build your custom training platform
   after your 7-day trial."
  [Maybe Later] [Upgrade Now]
```

---

## Edge Functions Needed

1. **create-checkout-session**
   - New signup → subscription with 7-day trial
   - Existing user → subscribe without trial

2. **stripe-webhook**
   - `customer.subscription.created` → create subscription record
   - `customer.subscription.updated` → sync status, reset calls if new period
   - `customer.subscription.deleted` → mark canceled
   - `invoice.paid` → handle call pack purchases
   - `checkout.session.completed` → handle call pack one-time purchases

3. **create-customer-portal-session**
   - Let users manage subscription / cancel

4. **purchase-call-pack**
   - Create Stripe checkout for one-time call pack purchase

---

## Frontend Components Needed

1. **useSubscription** - Get subscription data
2. **useFeatureAccess** - Check feature access
3. **useCallBalance** - Get call scoring balance
4. **FeatureGate** - Wrap restricted features
5. **UpgradeModal** - Show when blocked
6. **TrialBanner** - Show trial countdown
7. **CallBalanceIndicator** - Show calls remaining
8. **BuyCallsModal** - Purchase call packs

---

## Migration Files

1. `20260131073031_add_subscription_and_trial_system.sql`
   - subscriptions, feature_limits, feature_usage tables
   - All feature limit seed data

2. `20260131073720_add_call_scoring_limits_and_packs.sql`
   - Call scoring specific limits
   - call_packs, agency_call_balance, call_pack_purchases tables
   - Call scoring helper functions

---

## Implementation Order

### Phase 1: Database ✅
- [x] Create subscription tables migration
- [x] Create call scoring tables migration
- [ ] Deploy migrations

### Phase 2: Stripe Edge Functions
- [ ] create-checkout-session
- [ ] stripe-webhook
- [ ] create-customer-portal-session
- [ ] purchase-call-pack

### Phase 3: Frontend Hooks
- [ ] useSubscription
- [ ] useFeatureAccess
- [ ] useCallBalance

### Phase 4: Frontend Components
- [ ] FeatureGate
- [ ] UpgradeModal
- [ ] TrialBanner
- [ ] CallBalanceIndicator
- [ ] BuyCallsModal

### Phase 5: Integration
- [ ] Wire up marketing page CTA
- [ ] Add feature gates to restricted pages
- [ ] Add lock icons to sidebar
- [ ] Add call balance to call scoring page
- [ ] Test full flow

### Phase 6: Deploy
- [ ] Push migrations
- [ ] Deploy edge functions
- [ ] Deploy frontend
- [ ] Set up Stripe webhooks
- [ ] Test in production
