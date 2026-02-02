-- Update call_packs table with actual Stripe price IDs and correct pack sizes
-- Packs: 10, 30, 50, 100 calls

-- First, clear existing packs and insert fresh data
DELETE FROM call_packs;

INSERT INTO call_packs (name, description, call_count, price_cents, stripe_price_id, sort_order, is_active) VALUES
  ('10 Call Pack', 'Add 10 call scores to your account', 10, 4900, 'price_1Sw5hvFB8ViubgHocSqCSDq9', 1, TRUE),
  ('30 Call Pack', 'Add 30 call scores to your account', 30, 9900, 'price_1Sw5iVFB8ViubgHokUUy1IAx', 2, TRUE),
  ('50 Call Pack', 'Add 50 call scores to your account', 50, 14900, 'price_1Sw5joFB8ViubgHoP436Gv5t', 3, TRUE),
  ('100 Call Pack', 'Add 100 call scores to your account', 100, 24900, 'price_1Sw5kUFB8ViubgHonrqwmsAt', 4, TRUE);
