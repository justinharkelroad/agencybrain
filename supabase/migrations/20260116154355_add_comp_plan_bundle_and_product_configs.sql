-- Add bundle type configurations and product rate overrides to comp_plans
-- These are OPTIONAL fields that extend the existing compensation system

-- bundle_configs: Allows different payout configurations per bundle type (Monoline, Standard, Preferred)
-- Structure: {
--   "monoline": { "enabled": true, "payout_type": "percent_of_premium", "rate": 5, "tiers": [...] },
--   "standard": { "enabled": true, "payout_type": "flat_per_item", "tiers": [...] },
--   "preferred": { "enabled": true, "payout_type": "flat_per_item", "tiers": [...] }
-- }
ALTER TABLE comp_plans ADD COLUMN IF NOT EXISTS bundle_configs JSONB DEFAULT NULL;

-- product_rates: Allows different payout configurations per product/line of business
-- Structure: {
--   "Auto": { "payout_type": "flat_per_item", "rate": 25 },
--   "Home": { "payout_type": "percent_of_premium", "rate": 10 },
--   "Renters": { "payout_type": "flat_per_item", "rate": 10 }
-- }
ALTER TABLE comp_plans ADD COLUMN IF NOT EXISTS product_rates JSONB DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN comp_plans.bundle_configs IS 'Optional: Different payout configurations per bundle type (Monoline, Standard, Preferred). When null, uses default payout_type and tiers.';
COMMENT ON COLUMN comp_plans.product_rates IS 'Optional: Different payout configurations per product/line of business. When set, overrides bundle_configs for specific products.';
