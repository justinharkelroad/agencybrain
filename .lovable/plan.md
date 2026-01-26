
# Add Promo Code Support to 6-Week Challenge Checkout

## Problem
The current Stripe Checkout session for the 6-week challenge doesn't display a promo code input field. You have promo codes configured in Stripe, but customers can't apply them during checkout.

## Solution
Add `allow_promotion_codes: true` to the Stripe Checkout Session creation. This is a single-line change that enables Stripe's built-in promo code field on the checkout page.

## What Customers Will See After Fix
When customers click the purchase button, the Stripe checkout page will now display:
- A "Add promotion code" link below the payment details
- When clicked, an input field appears where customers can enter any promo code you've created in Stripe
- Stripe automatically validates and applies the discount

## Implementation

### File: `supabase/functions/challenge-create-checkout/index.ts`

**Change:** Add `allow_promotion_codes: true` to the checkout session creation (line 128-154)

```typescript
const session = await stripe.checkout.sessions.create({
  payment_method_types: ['card'],
  mode: 'payment',
  customer_email: profile.email || user.email,
  allow_promotion_codes: true,  // ← ADD THIS LINE
  line_items: [
    // ... existing line items
  ],
  metadata: {
    // ... existing metadata
  },
  success_url: success_url || `${req.headers.get('origin')}/training/challenge/purchase-success?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: cancel_url || `${req.headers.get('origin')}/training/challenge`,
});
```

## Technical Notes

1. **Stripe handles everything**: No database changes or frontend changes needed. Stripe's checkout page automatically shows the promo code field and applies discounts.

2. **Works with existing Stripe promo codes**: Any promotion codes you've already created in Stripe Dashboard will work immediately.

3. **Applies to all challenge purchases**: Every purchase of the 6-week challenge (regardless of seat quantity or membership tier) will have the promo code option.

4. **Discount tracking**: Stripe records which promo code was used in the session, visible in your Stripe Dashboard for reporting.

## Files Modified
| File | Change |
|------|--------|
| `supabase/functions/challenge-create-checkout/index.ts` | Add `allow_promotion_codes: true` |

## Testing
After deployment:
1. Go to `/training/challenge` and click purchase
2. On the Stripe checkout page, look for "Add promotion code" link
3. Enter a valid Stripe promo code and verify the discount applies
