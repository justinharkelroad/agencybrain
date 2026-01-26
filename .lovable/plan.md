
# Implement Fallback Payment Verification for Challenge Purchases

## Problem
With the Stripe webhook now configured, future payments should process correctly. However, if there's ever a webhook delay or failure, customers would still get stuck on "Processing Payment." This plan adds a fallback verification system as a safety net.

## Solution Overview
Create a backup verification edge function that directly queries Stripe to confirm payment status. The success page will use this as a fallback if database polling times out.

## Implementation

### Step 1: Create Verification Edge Function

**New File:** `supabase/functions/challenge-verify-session/index.ts`

This function:
1. Receives `session_id` from the frontend
2. Authenticates the user
3. Calls Stripe API to check if `payment_status === 'paid'`
4. If paid, updates the database record to `completed`
5. Returns the verified purchase details

```typescript
// Key logic:
const session = await stripe.checkout.sessions.retrieve(session_id);
if (session.payment_status === 'paid') {
  // Update purchase to 'completed' in database
  // Return success with purchase details
}
```

### Step 2: Add Config Entry

**File:** `supabase/config.toml`

Add:
```toml
[functions.challenge-verify-session]
verify_jwt = false
```

### Step 3: Update Success Page

**File:** `src/pages/training/ChallengePurchaseSuccess.tsx`

Changes:
1. After database polling times out (10 attempts), call `challenge-verify-session`
2. If verification succeeds, show success state
3. Add a manual "Verify Payment" button for retry
4. Improve the error state with a verification button

**Updated Flow:**
```text
Poll database (10 attempts, 1 sec each)
       |
  [If found] → Show success
       |
  [If timeout] → Call challenge-verify-session
                      |
                 [If paid] → Show success
                      |
                 [If not paid] → Show "still processing" with retry button
```

## Files Summary

| File | Action | Purpose |
|------|--------|---------|
| `supabase/functions/challenge-verify-session/index.ts` | Create | Fallback Stripe verification |
| `supabase/config.toml` | Modify | Add function config |
| `src/pages/training/ChallengePurchaseSuccess.tsx` | Modify | Add fallback verification call |

## Security Notes

- User must be authenticated to call verification
- Session is verified directly with Stripe's API (source of truth)
- Only the matching agency's purchase can be updated

## Testing

After deployment:
1. Make a test purchase
2. The page should show success (webhook should work now)
3. If webhook ever fails, the fallback kicks in automatically

## Bonus: Fix Your Stuck Purchase

Once this is deployed, you can go back to the success page with your original session_id and it will verify and complete the purchase automatically.
