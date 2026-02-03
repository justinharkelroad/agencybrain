# Subscription System & Marketing Landing Page Handoff

## Overview

This document covers the implementation of AgencyBrain's subscription system with:
- $299/month subscription with 7-day auto-converting free trial
- Trial feature restrictions (view/submit scorecards, but not edit)
- 3 trial call scoring credits, 20/month for paid users
- Payment failed (past_due) lockout
- Call pack add-on purchases (10/30/50/100 calls)

---

## What's Been Built

### Database (All Deployed to Production)

| Table | Purpose | Status |
|-------|---------|--------|
| `subscriptions` | Stripe subscription tracking | ✅ Created |
| `feature_limits` | Defines access per subscription status | ✅ Created & seeded |
| `feature_usage` | Tracks limited feature usage | ✅ Created |
| `call_packs` | Available call packs for purchase | ✅ Created & updated with Stripe prices |
| `agency_call_balance` | Tracks subscription + purchased calls | ✅ Created |
| `call_pack_purchases` | Purchase history | ✅ Created |

**Columns added to `agencies` table:**
- `stripe_customer_id`
- `subscription_status`

**Database Helper Functions:**
- `check_feature_access()` - Check if a feature is accessible
- `increment_feature_usage()` - Track usage of limited features
- `check_call_scoring_access()` - Check call scoring balance
- `use_call_score()` - Decrement call balance
- `add_purchased_calls()` - Add purchased calls
- `reset_subscription_calls()` - Reset monthly calls

### Edge Functions (All Deployed)

| Function | Purpose | Status |
|----------|---------|--------|
| `stripe-webhook` | Handles all Stripe webhook events | ✅ Deployed |
| `create-checkout-session` | Creates subscription checkout with trial | ✅ Deployed |
| `create-customer-portal-session` | Opens Stripe billing portal | ✅ Deployed |

**Webhook handles:**
- `customer.subscription.created/updated/deleted`
- `checkout.session.completed` (call packs)
- `invoice.paid` (resets monthly calls)
- `invoice.payment_failed` (triggers past_due)

**Emails sent automatically:**
- Trial welcome email
- Trial activated (converted to paid)
- Subscription canceled
- Payment failed

### Frontend Components

| Component | Purpose | Status |
|-----------|---------|--------|
| `TrialBanner` | Informational banner showing trial days remaining | ✅ Created |
| `PaymentFailedLockout` | Full-screen lockout for past_due users | ✅ Created |
| `FeatureGate` | Blurs/blocks features during trial | ✅ Created |
| `useSubscription` hook | Fetches subscription status | ✅ Created |
| `useFeatureAccess` hook | Checks feature access | ✅ Created |

### Subscription UI in App

| Feature | Status |
|---------|--------|
| Trial banner in main layout | ✅ Integrated in `SidebarLayout.tsx` |
| Payment lockout when past_due | ✅ Integrated in `SidebarLayout.tsx` |
| FeatureGate on scorecard edit pages | ✅ Applied to `ScorecardFormEditor.tsx`, `ScorecardFormBuilder.tsx`, `Settings.tsx` |
| Clock icons in sidebar for trial-restricted items | ✅ Added to `SidebarNavItem.tsx`, `SidebarSubFolder.tsx`, `StaffSidebarFolder.tsx`, `StaffSidebar.tsx` |
| Billing settings page | ✅ Created at `/settings/billing` |

### Test Pages (Hidden)

| Page | URL | Purpose |
|------|-----|---------|
| `SubscriptionPreview` | `/preview/subscription` | Preview trial/active/past_due UI states |
| `TestCheckout` | `/test/checkout` | Test Stripe checkout flow |

---

## Stripe Configuration

### Products & Prices (In Stripe Dashboard)

| Product | Price ID | Amount |
|---------|----------|--------|
| AgencyBrain Subscription | `price_1Sw5YpFB8ViubgHoHH7BYecB` | $299/month |
| Call Pack - 10 Calls | `price_1Sw5hvFB8ViubgHocSqCSDq9` | TBD |
| Call Pack - 30 Calls | `price_1Sw5iVFB8ViubgHokUUy1IAx` | TBD |
| Call Pack - 50 Calls | `price_1Sw5joFB8ViubgHoP436Gv5t` | TBD |
| Call Pack - 100 Calls | `price_1Sw5kUFB8ViubgHonrqwmsAt` | TBD |

### Supabase Secrets (All Set)

| Secret | Purpose |
|--------|---------|
| `STRIPE_SECRET_KEY` | Stripe API access |
| `STRIPE_PRICE_ID` | $299/mo subscription price |
| `STRIPE_WEBHOOK_SECRET` | For `challenge-webhook` |
| `STRIPE_SUBSCRIPTION_WEBHOOK_SECRET` | For `stripe-webhook` (subscriptions) |

### Webhooks in Stripe

| Webhook | Endpoint | Secret |
|---------|----------|--------|
| Challenge webhook | `.../functions/v1/challenge-webhook` | `STRIPE_WEBHOOK_SECRET` |
| Subscription webhook | `.../functions/v1/stripe-webhook` | `STRIPE_SUBSCRIPTION_WEBHOOK_SECRET` |

---

## Feature Limits by Subscription Status

### Trial (7 days)
- ✅ View/submit scorecards
- ❌ Edit/create scorecards
- ❌ Scorecard settings
- ✅ 3 call scoring credits
- ✅ 2 AI roleplay sessions
- ✅ Standard Playbook training
- ❌ Manage/Agency training
- ✅ Core 4, Monthly Missions, Life Targets
- ❌ Quarterly Targets, 90-Day Audio

### Active ($299/mo)
- ✅ Everything except AI roleplay
- ✅ 20 call scoring credits/month
- ✅ Can purchase additional call packs

### 1-on-1 Client
- ✅ Everything unlimited

---

## Marketing Landing Page (BUILT)

The marketing landing page is fully built at `/marketing` route.

### Components Created

| Component | File | Purpose |
|-----------|------|---------|
| `MarketingLanding` | `src/pages/MarketingLanding.tsx` | Main page orchestrator |
| `MarketingHeader` | `src/components/marketing/MarketingHeader.tsx` | Sticky nav with Login/Start Trial |
| `HeroSection` | `src/components/marketing/HeroSection.tsx` | Headline + floating mockups |
| `BentoFeatureGrid` | `src/components/marketing/BentoFeatureGrid.tsx` | 8-feature grid |
| `BentoCard` | `src/components/marketing/BentoCard.tsx` | Individual feature card |
| `FeatureShowcase` | `src/components/marketing/FeatureShowcase.tsx` | Full-width feature deep dives |
| `HowItWorks` | `src/components/marketing/HowItWorks.tsx` | 4-step process |
| `PricingSection` | `src/components/marketing/PricingSection.tsx` | $299/mo pricing |
| `FinalCTA` | `src/components/marketing/FinalCTA.tsx` | Bottom CTA |
| `MarketingFooter` | `src/components/marketing/MarketingFooter.tsx` | Footer |
| `StartTrialButton` | `src/components/marketing/StartTrialButton.tsx` | Trial signup button |

### UI Components (`src/components/marketing/ui/`)
- `FloatingMockup.tsx`
- `GradientText.tsx`
- `ScrollReveal.tsx`
- Various animation utilities

### Design
- Dark theme with coral (#F27649) and teal (#29D9B3) accents
- Framer Motion scroll animations
- Bento-grid feature cards
- Responsive (mobile/tablet/desktop)

### Routes
- `/marketing` - The landing page
- Add `?preview=1` to view even when logged in

---

## What's NOT Built Yet

### Public Signup Flow
- The "Start Free Trial" button on the landing page needs to work without being logged in
- Flow should be: Collect email/name → Create account → Redirect to Stripe checkout
- Currently `TestCheckout` requires being logged in first
- `StartTrialButton` component exists but may need wiring up

### Screenshots for Landing Page
- The landing page has placeholder mockups
- Need to capture real screenshots from the running app for:
  - Call Scoring results
  - Scorecard/metrics dashboard
  - AI Role-play interface
  - And other features

### Current Bug to Fix
The `/test/checkout` page returns 403 "Access denied" when calling `create-checkout-session`. This may be:
1. Edge function needs to allow unauthenticated requests (for public signup)
2. Missing `APP_URL` environment variable
3. CORS or JWT verification issue

---

## Key Files Reference

### Database Migrations
- `supabase/migrations/20260131073031_add_subscription_and_trial_system.sql`
- `supabase/migrations/20260131073720_add_call_scoring_limits_and_packs.sql`
- `supabase/migrations/20260201140500_update_call_packs_with_stripe_prices.sql`

### Edge Functions
- `supabase/functions/stripe-webhook/index.ts`
- `supabase/functions/create-checkout-session/index.ts`
- `supabase/functions/create-customer-portal-session/index.ts`

### Frontend - Subscription
- `src/components/subscription/` - TrialBanner, FeatureGate, PaymentFailedLockout
- `src/hooks/useSubscription.ts`
- `src/hooks/useFeatureAccess.ts`
- `src/pages/TestCheckout.tsx`
- `src/pages/SubscriptionPreview.tsx`
- `src/pages/BillingSettings.tsx`

### Frontend - Marketing Landing Page
- `src/pages/MarketingLanding.tsx` - Main page
- `src/components/marketing/MarketingHeader.tsx`
- `src/components/marketing/HeroSection.tsx`
- `src/components/marketing/BentoFeatureGrid.tsx`
- `src/components/marketing/BentoCard.tsx`
- `src/components/marketing/FeatureShowcase.tsx`
- `src/components/marketing/HowItWorks.tsx`
- `src/components/marketing/PricingSection.tsx`
- `src/components/marketing/FinalCTA.tsx`
- `src/components/marketing/MarketingFooter.tsx`
- `src/components/marketing/StartTrialButton.tsx`
- `src/components/marketing/ui/` - Animation utilities

### Navigation
- `src/config/navigation.ts` - Has `trialRestricted` property on NavItem
- `src/components/sidebar/SidebarNavItem.tsx` - Shows clock icon for trial restrictions

---

## Prompt to Continue

```
I'm continuing work on the AgencyBrain subscription system and marketing landing page.

Read SUBSCRIPTION_SYSTEM_HANDOFF.md for full context on what's been built.

Current status:
- Subscription system backend is COMPLETE (database, webhooks, edge functions)
- Trial UI (banners, feature gates, lock icons) is INTEGRATED
- Marketing landing page is BUILT at /marketing (all components done)
- Test checkout page exists at /test/checkout but returns 403 error

What's working:
- Database tables and Stripe configuration
- Webhook handling for subscriptions
- Trial/active/past_due UI states
- Landing page with all sections

What needs work:
1. Fix the 403 "Access denied" error on create-checkout-session
2. Wire up the "Start Free Trial" button on the landing page to work for unauthenticated users
3. Add real screenshots to the landing page (currently has placeholders)
4. Test the full checkout → trial → paid conversion flow
```

---

## Testing Checklist

### Subscription System
- [ ] Test checkout at `/test/checkout` (currently 403 error)
- [ ] Verify webhook receives events in Stripe dashboard
- [ ] Test trial → active conversion
- [ ] Test payment failed → past_due lockout
- [ ] Test call pack purchase flow
- [ ] Verify trial banner shows/dismisses
- [ ] Verify feature gates block scorecard editing during trial
- [ ] Verify clock icons appear in sidebar during trial

### Marketing Landing Page
- [ ] View landing page at `/marketing`
- [ ] Test all sections render correctly
- [ ] Test responsive design (mobile/tablet/desktop)
- [ ] Test "Login" button navigates to `/auth`
- [ ] Test "Start Free Trial" button (needs wiring up)
- [ ] Verify logged-in users redirect to dashboard (unless `?preview=1`)
- [ ] Add real screenshots to replace placeholders
