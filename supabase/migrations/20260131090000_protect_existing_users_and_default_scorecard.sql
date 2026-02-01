-- =============================================================================
-- PROTECT EXISTING USERS & AUTO-CREATE DEFAULT SCORECARDS
-- =============================================================================
-- This migration:
-- 1. Syncs existing users' membership_tier to subscription_status
-- 2. Creates a trigger to auto-generate default scorecards for new agencies
-- 3. Ensures existing users are not affected by new subscription system
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. SYNC EXISTING USERS
-- -----------------------------------------------------------------------------
-- Update agencies.subscription_status based on their owner's membership_tier
-- This is a ONE-TIME migration for existing users

UPDATE agencies a
SET subscription_status = CASE
  -- Cast to text for safe comparison with string literals
  WHEN p.membership_tier::text IN ('one_on_one', '1:1 Coaching', '1on1', '1-on-1') THEN '1on1_client'
  WHEN p.membership_tier::text IN ('boardroom', 'Boardroom Level', 'Boardroom') THEN 'active'
  WHEN p.membership_tier::text IN ('call_scoring', 'Call Scoring Only', 'Call Scoring') THEN 'active'
  ELSE 'active'  -- Default existing users to 'active' to not break anything
END
FROM profiles p
WHERE p.agency_id = a.id
  AND p.membership_tier IS NOT NULL
  AND (a.subscription_status IS NULL OR a.subscription_status = 'none');

-- Log how many were updated
DO $$
DECLARE
  updated_count INT;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % agencies with subscription_status from membership_tier', updated_count;
END $$;

-- -----------------------------------------------------------------------------
-- 2. SET UP CALL BALANCE FOR EXISTING 1-ON-1 CLIENTS
-- -----------------------------------------------------------------------------
-- Ensure 1-on-1 clients have unlimited call balance

INSERT INTO agency_call_balance (agency_id, subscription_calls_limit, subscription_calls_used, purchased_calls_remaining)
SELECT
  a.id,
  -1,  -- -1 = unlimited for 1-on-1 clients
  0,
  0
FROM agencies a
WHERE a.subscription_status = '1on1_client'
  AND NOT EXISTS (
    SELECT 1 FROM agency_call_balance acb WHERE acb.agency_id = a.id
  );

-- For active (boardroom) users, set up 20 calls/month
INSERT INTO agency_call_balance (agency_id, subscription_calls_limit, subscription_calls_used, purchased_calls_remaining, subscription_period_start)
SELECT
  a.id,
  20,
  0,
  0,
  date_trunc('month', CURRENT_DATE)::DATE
FROM agencies a
WHERE a.subscription_status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM agency_call_balance acb WHERE acb.agency_id = a.id
  );

-- -----------------------------------------------------------------------------
-- 3. DEFAULT SCORECARD TEMPLATE
-- -----------------------------------------------------------------------------
-- Create a table to store default scorecard templates

CREATE TABLE IF NOT EXISTS default_scorecard_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL,  -- 'Sales', 'Service', 'Hybrid', 'Manager'
  kpis JSONB NOT NULL,  -- Array of default KPI configurations
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(role)
);

COMMENT ON TABLE default_scorecard_templates IS 'Default scorecard configurations for new agencies';

-- Insert default templates for each role
INSERT INTO default_scorecard_templates (role, kpis) VALUES
(
  'Sales',
  '[
    {"key": "new_items", "label": "New Items", "target": 10, "weight": 25, "enabled": true},
    {"key": "quoted_items", "label": "Quoted Items", "target": 30, "weight": 20, "enabled": true},
    {"key": "dial_count", "label": "Dials", "target": 50, "weight": 15, "enabled": true},
    {"key": "appointments_set", "label": "Appointments Set", "target": 5, "weight": 15, "enabled": true},
    {"key": "premium_sold", "label": "Premium Sold", "target": 5000, "weight": 25, "enabled": true}
  ]'::JSONB
),
(
  'Service',
  '[
    {"key": "service_calls", "label": "Service Calls", "target": 20, "weight": 30, "enabled": true},
    {"key": "retention_calls", "label": "Retention Calls", "target": 10, "weight": 25, "enabled": true},
    {"key": "policy_reviews", "label": "Policy Reviews", "target": 5, "weight": 20, "enabled": true},
    {"key": "cross_sells", "label": "Cross-Sells", "target": 3, "weight": 25, "enabled": true}
  ]'::JSONB
),
(
  'Hybrid',
  '[
    {"key": "new_items", "label": "New Items", "target": 5, "weight": 20, "enabled": true},
    {"key": "quoted_items", "label": "Quoted Items", "target": 15, "weight": 15, "enabled": true},
    {"key": "service_calls", "label": "Service Calls", "target": 15, "weight": 20, "enabled": true},
    {"key": "retention_calls", "label": "Retention Calls", "target": 8, "weight": 20, "enabled": true},
    {"key": "cross_sells", "label": "Cross-Sells", "target": 3, "weight": 25, "enabled": true}
  ]'::JSONB
),
(
  'Manager',
  '[
    {"key": "team_meetings", "label": "Team Meetings", "target": 5, "weight": 20, "enabled": true},
    {"key": "one_on_ones", "label": "1:1 Coaching Sessions", "target": 10, "weight": 30, "enabled": true},
    {"key": "pipeline_reviews", "label": "Pipeline Reviews", "target": 5, "weight": 25, "enabled": true},
    {"key": "training_sessions", "label": "Training Sessions", "target": 2, "weight": 25, "enabled": true}
  ]'::JSONB
)
ON CONFLICT (role) DO UPDATE SET
  kpis = EXCLUDED.kpis,
  updated_at = NOW();

-- -----------------------------------------------------------------------------
-- 4. FUNCTION TO CREATE DEFAULT SCORECARDS
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION create_default_scorecards_for_agency(p_agency_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  template RECORD;
BEGIN
  -- Loop through each role template
  FOR template IN SELECT * FROM default_scorecard_templates
  LOOP
    -- Insert scorecard_rules if not exists
    INSERT INTO scorecard_rules (agency_id, role, is_default)
    VALUES (p_agency_id, template.role, TRUE)
    ON CONFLICT (agency_id, role) DO NOTHING;
  END LOOP;

  RAISE NOTICE 'Created default scorecards for agency %', p_agency_id;
END;
$$;

COMMENT ON FUNCTION create_default_scorecards_for_agency IS 'Creates default scorecard rules for a new agency';

-- -----------------------------------------------------------------------------
-- 5. TRIGGER TO AUTO-CREATE SCORECARDS FOR NEW AGENCIES
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION trigger_create_default_scorecards()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Create default scorecards for the new agency
  PERFORM create_default_scorecards_for_agency(NEW.id);
  RETURN NEW;
END;
$$;

-- Only create trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_agency_created_create_scorecards'
  ) THEN
    CREATE TRIGGER on_agency_created_create_scorecards
      AFTER INSERT ON agencies
      FOR EACH ROW
      EXECUTE FUNCTION trigger_create_default_scorecards();
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 6. BACKFILL: Create default scorecards for existing agencies that don't have any
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  agency_record RECORD;
  backfill_count INT := 0;
BEGIN
  FOR agency_record IN
    SELECT DISTINCT a.id
    FROM agencies a
    WHERE NOT EXISTS (
      SELECT 1 FROM scorecard_rules sr WHERE sr.agency_id = a.id
    )
  LOOP
    PERFORM create_default_scorecards_for_agency(agency_record.id);
    backfill_count := backfill_count + 1;
  END LOOP;

  RAISE NOTICE 'Backfilled default scorecards for % agencies', backfill_count;
END $$;

-- -----------------------------------------------------------------------------
-- 7. ADD FEATURE LIMIT FALLBACK FOR LEGACY TIERS
-- -----------------------------------------------------------------------------
-- Add entries for users who might have 'active' status but came from different tiers

-- Ensure 'active' users have full access to all features (covers boardroom tier)
-- This is already seeded, but let's make sure it's complete

-- Add 'none' status entries - these users need to subscribe
INSERT INTO feature_limits (subscription_status, feature_key, access_type, usage_limit, description, upgrade_message)
SELECT 'none', feature_key, 'none', NULL, description, 'Please subscribe to access this feature.'
FROM feature_limits
WHERE subscription_status = 'trialing'
ON CONFLICT (subscription_status, feature_key) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 8. RLS POLICY UPDATE
-- -----------------------------------------------------------------------------
-- Ensure the subscription components can read necessary data

-- Allow users to read their agency's call balance
DROP POLICY IF EXISTS "Users can view their agency call balance" ON agency_call_balance;
CREATE POLICY "Users can view their agency call balance"
  ON agency_call_balance FOR SELECT
  USING (
    agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid())
    OR agency_id IN (SELECT agency_id FROM key_employees WHERE user_id = auth.uid())
  );
