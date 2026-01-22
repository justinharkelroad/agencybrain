-- Add extended compensation plan configurations
-- These support advanced comp plan features: custom point values, bundling bonuses, and self-gen modifiers

-- point_values: Custom point values per product for tier qualification
-- Used when tier_metric = 'points' to assign different point weights to products
-- Structure: {
--   "Auto": 1,
--   "Home": 2,
--   "Life": 3,
--   "Umbrella": 1,
--   "Renters": 0.5
-- }
ALTER TABLE comp_plans ADD COLUMN IF NOT EXISTS point_values JSONB DEFAULT NULL;

-- bundling_multipliers: Bonus multipliers based on bundling percentage
-- Applies a multiplier to commission based on % of bundled policies
-- Structure: {
--   "thresholds": [
--     { "min_percent": 50, "multiplier": 1.10 },
--     { "min_percent": 70, "multiplier": 1.25 },
--     { "min_percent": 85, "multiplier": 1.40 }
--   ]
-- }
ALTER TABLE comp_plans ADD COLUMN IF NOT EXISTS bundling_multipliers JSONB DEFAULT NULL;

-- commission_modifiers: Self-gen requirements and kickers
-- Controls self-generated lead requirements and bonuses
-- Structure: {
--   "self_gen_requirement": {
--     "min_percent": 25,
--     "source": "written",
--     "affects_qualification": true,
--     "affects_payout": false
--   },
--   "self_gen_kicker": {
--     "enabled": true,
--     "type": "per_item",
--     "amount": 5,
--     "min_self_gen_percent": 30
--   }
-- }
-- type options: "per_item", "per_policy", "per_household"
ALTER TABLE comp_plans ADD COLUMN IF NOT EXISTS commission_modifiers JSONB DEFAULT NULL;

-- Add comments for documentation
COMMENT ON COLUMN comp_plans.point_values IS 'Custom point values per product for tier qualification when tier_metric=points. Keys are product names, values are point weights.';
COMMENT ON COLUMN comp_plans.bundling_multipliers IS 'Bonus multipliers applied based on bundling percentage. Contains thresholds array with min_percent and multiplier.';
COMMENT ON COLUMN comp_plans.commission_modifiers IS 'Self-gen requirements and kickers. Contains self_gen_requirement (qualification rules) and self_gen_kicker (bonus for self-generated leads).';
