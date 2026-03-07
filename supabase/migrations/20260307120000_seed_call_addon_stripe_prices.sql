-- Seed 10-call addon tier and backfill Stripe price IDs for all addon plans

-- Add 10 calls/month tier
INSERT INTO public.call_scoring_addons (name, description, calls_per_month, price_cents, stripe_price_id, sort_order)
VALUES ('10 Calls/Month', 'Add 10 call scores per month to your plan', 10, 6900, 'price_1Sw5hvFB8ViubgHocSqCSDq9', 0);

-- Backfill Stripe price IDs for existing tiers
UPDATE public.call_scoring_addons SET stripe_price_id = 'price_1Sw5iVFB8ViubgHokUUy1IAx' WHERE calls_per_month = 30;
UPDATE public.call_scoring_addons SET stripe_price_id = 'price_1Sw5joFB8ViubgHoP436Gv5t' WHERE calls_per_month = 50;
UPDATE public.call_scoring_addons SET stripe_price_id = 'price_1Sw5kUFB8ViubgHonrqwmsAt' WHERE calls_per_month = 100;
