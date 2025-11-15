-- Add JSONB columns for multiple daily actions per domain
ALTER TABLE life_targets_quarterly
ADD COLUMN IF NOT EXISTS body_daily_actions JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS being_daily_actions JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS balance_daily_actions JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS business_daily_actions JSONB DEFAULT '[]'::jsonb;

-- Add comment explaining the new columns
COMMENT ON COLUMN life_targets_quarterly.body_daily_actions IS 'Array of daily action strings for body domain';
COMMENT ON COLUMN life_targets_quarterly.being_daily_actions IS 'Array of daily action strings for being domain';
COMMENT ON COLUMN life_targets_quarterly.balance_daily_actions IS 'Array of daily action strings for balance domain';
COMMENT ON COLUMN life_targets_quarterly.business_daily_actions IS 'Array of daily action strings for business domain';

-- Migrate existing single habits to arrays (if any exist)
UPDATE life_targets_quarterly
SET body_daily_actions = 
  CASE 
    WHEN body_daily_habit IS NOT NULL AND body_daily_habit != '' 
    THEN jsonb_build_array(body_daily_habit)
    ELSE '[]'::jsonb
  END
WHERE body_daily_actions = '[]'::jsonb;

UPDATE life_targets_quarterly
SET being_daily_actions = 
  CASE 
    WHEN being_daily_habit IS NOT NULL AND being_daily_habit != '' 
    THEN jsonb_build_array(being_daily_habit)
    ELSE '[]'::jsonb
  END
WHERE being_daily_actions = '[]'::jsonb;

UPDATE life_targets_quarterly
SET balance_daily_actions = 
  CASE 
    WHEN balance_daily_habit IS NOT NULL AND balance_daily_habit != '' 
    THEN jsonb_build_array(balance_daily_habit)
    ELSE '[]'::jsonb
  END
WHERE balance_daily_actions = '[]'::jsonb;

UPDATE life_targets_quarterly
SET business_daily_actions = 
  CASE 
    WHEN business_daily_habit IS NOT NULL AND business_daily_habit != '' 
    THEN jsonb_build_array(business_daily_habit)
    ELSE '[]'::jsonb
  END
WHERE business_daily_actions = '[]'::jsonb;