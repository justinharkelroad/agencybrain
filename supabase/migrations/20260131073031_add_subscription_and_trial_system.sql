-- =============================================================================
-- SUBSCRIPTION & TRIAL FEATURE SYSTEM
-- =============================================================================
-- This migration adds:
-- 1. subscriptions table - tracks Stripe subscription status per agency
-- 2. feature_limits table - defines what each subscription status can access
-- 3. feature_usage table - tracks usage of limited features (e.g., roleplay sessions)
-- 4. Adds stripe columns to agencies table
-- 5. Helper functions for checking access and incrementing usage
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ADD STRIPE COLUMNS TO AGENCIES TABLE
-- -----------------------------------------------------------------------------
ALTER TABLE agencies
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'none';

COMMENT ON COLUMN agencies.stripe_customer_id IS 'Stripe customer ID for billing';
COMMENT ON COLUMN agencies.subscription_status IS 'Current subscription status: none, trialing, active, canceled, past_due';

CREATE INDEX IF NOT EXISTS idx_agencies_stripe_customer_id ON agencies(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_agencies_subscription_status ON agencies(subscription_status);

-- -----------------------------------------------------------------------------
-- 2. SUBSCRIPTIONS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  stripe_customer_id TEXT NOT NULL,
  stripe_subscription_id TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'trialing',
  -- Status values: 'trialing', 'active', 'canceled', 'past_due', 'unpaid', 'incomplete'
  price_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE subscriptions IS 'Stores Stripe subscription data synced via webhooks';

CREATE INDEX idx_subscriptions_agency_id ON subscriptions(agency_id);
CREATE INDEX idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

-- RLS for subscriptions
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their agency subscription"
  ON subscriptions FOR SELECT
  USING (agency_id IN (
    SELECT agency_id FROM profiles WHERE id = auth.uid()
  ));

-- Only service role can insert/update (via webhooks)
CREATE POLICY "Service role can manage subscriptions"
  ON subscriptions FOR ALL
  USING (auth.role() = 'service_role');

-- -----------------------------------------------------------------------------
-- 3. FEATURE LIMITS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS feature_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_status TEXT NOT NULL,
  feature_key TEXT NOT NULL,
  access_type TEXT NOT NULL CHECK (access_type IN ('full', 'limited', 'none')),
  usage_limit INT,  -- NULL = N/A, -1 = unlimited, N = count limit
  description TEXT,
  upgrade_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(subscription_status, feature_key)
);

COMMENT ON TABLE feature_limits IS 'Defines feature access levels per subscription status';
COMMENT ON COLUMN feature_limits.access_type IS 'full = unrestricted, limited = has usage_limit, none = blocked';
COMMENT ON COLUMN feature_limits.usage_limit IS 'NULL = not applicable, -1 = unlimited, positive number = max uses per period';

-- RLS for feature_limits (read-only for all authenticated users)
ALTER TABLE feature_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read feature limits"
  ON feature_limits FOR SELECT
  USING (true);

-- -----------------------------------------------------------------------------
-- 4. SEED FEATURE LIMITS DATA
-- -----------------------------------------------------------------------------
INSERT INTO feature_limits (subscription_status, feature_key, access_type, usage_limit, description, upgrade_message) VALUES
  -- ===================
  -- TRIAL LIMITS
  -- ===================
  -- AI Roleplay: 2 sessions during trial
  ('trialing', 'ai_roleplay', 'limited', 2, 'AI Sales Roleplay', 'You''ve used your 2 trial roleplay sessions. Upgrade to continue practicing with AI.'),

  -- Scorecards: Can view/submit but not edit or create
  ('trialing', 'scorecard_view', 'full', -1, 'View Scorecards', NULL),
  ('trialing', 'scorecard_submit', 'full', -1, 'Submit Scorecard Data', NULL),
  ('trialing', 'scorecard_edit', 'none', NULL, 'Edit Scorecards', 'Customize your scorecards after your 7-day trial.'),
  ('trialing', 'scorecard_create', 'none', NULL, 'Create Scorecards', 'Create custom scorecards after your 7-day trial.'),
  ('trialing', 'scorecard_settings', 'none', NULL, 'Scorecard Settings', 'Manage scorecard settings after your 7-day trial.'),

  -- Training: Standard Playbook yes, Manage/Agency no
  ('trialing', 'training_standard', 'full', -1, 'Standard Playbook Training', NULL),
  ('trialing', 'training_manage', 'none', NULL, 'Manage Training', 'Build your custom training platform after your 7-day trial.'),
  ('trialing', 'training_agency', 'none', NULL, 'Agency Training', 'Create agency-specific training content after your 7-day trial.'),

  -- Agency Tools: Comp Analyzer yes, Bonus Tool & Call Efficiency no
  ('trialing', 'comp_analyzer', 'full', -1, 'Comp Analyzer', NULL),
  ('trialing', 'commission_builder', 'full', -1, 'Commission Builder', NULL),
  ('trialing', 'bonus_tool', 'none', NULL, 'Bonus Tool', 'Access the Bonus Tool to calculate team bonuses after your 7-day trial.'),
  ('trialing', 'call_efficiency', 'none', NULL, 'Call Efficiency Tool', 'Access the Call Efficiency Tool after your 7-day trial.'),

  -- Personal Growth: Core 4 yes, Quarterly Targets & 90-Day Audio no
  ('trialing', 'core4', 'full', -1, 'Core 4 Tracking', NULL),
  ('trialing', 'monthly_missions', 'full', -1, 'Monthly Missions', NULL),
  ('trialing', 'life_targets', 'full', -1, 'Life Targets', NULL),
  ('trialing', 'quarterly_targets', 'none', NULL, 'Quarterly Targets', 'Set quarterly targets after your 7-day trial.'),
  ('trialing', '90_day_audio', 'none', NULL, '90-Day Audio', 'Access the 90-Day Audio program after your 7-day trial.'),

  -- Full access features during trial
  ('trialing', 'dashboard', 'full', -1, 'Dashboard', NULL),
  ('trialing', 'cancel_audit', 'full', -1, 'Cancel Audit', NULL),
  ('trialing', 'winback_hq', 'full', -1, 'Winback HQ', NULL),
  ('trialing', 'renewal_tracking', 'full', -1, 'Renewal Tracking', NULL),
  ('trialing', 'lqs_tracking', 'full', -1, 'LQS Tracking', NULL),
  ('trialing', 'sales', 'full', -1, 'Sales Logging', NULL),
  ('trialing', 'leaderboard', 'full', -1, 'Leaderboard', NULL),
  ('trialing', 'team_rings', 'full', -1, 'Team Rings', NULL),
  ('trialing', 'contacts', 'full', -1, 'Contacts', NULL),

  -- ===================
  -- PAID ($299/mo) LIMITS
  -- ===================
  -- AI Roleplay: Not included in base plan
  ('active', 'ai_roleplay', 'none', 0, 'AI Sales Roleplay', 'AI Roleplay is available for 1-on-1 coaching clients. Contact us to upgrade.'),

  -- Scorecards: Full access
  ('active', 'scorecard_view', 'full', -1, 'View Scorecards', NULL),
  ('active', 'scorecard_submit', 'full', -1, 'Submit Scorecard Data', NULL),
  ('active', 'scorecard_edit', 'full', -1, 'Edit Scorecards', NULL),
  ('active', 'scorecard_create', 'full', -1, 'Create Scorecards', NULL),
  ('active', 'scorecard_settings', 'full', -1, 'Scorecard Settings', NULL),

  -- Training: Full access
  ('active', 'training_standard', 'full', -1, 'Standard Playbook Training', NULL),
  ('active', 'training_manage', 'full', -1, 'Manage Training', NULL),
  ('active', 'training_agency', 'full', -1, 'Agency Training', NULL),

  -- Agency Tools: Full access
  ('active', 'comp_analyzer', 'full', -1, 'Comp Analyzer', NULL),
  ('active', 'commission_builder', 'full', -1, 'Commission Builder', NULL),
  ('active', 'bonus_tool', 'full', -1, 'Bonus Tool', NULL),
  ('active', 'call_efficiency', 'full', -1, 'Call Efficiency Tool', NULL),

  -- Personal Growth: Full access
  ('active', 'core4', 'full', -1, 'Core 4 Tracking', NULL),
  ('active', 'monthly_missions', 'full', -1, 'Monthly Missions', NULL),
  ('active', 'life_targets', 'full', -1, 'Life Targets', NULL),
  ('active', 'quarterly_targets', 'full', -1, 'Quarterly Targets', NULL),
  ('active', '90_day_audio', 'full', -1, '90-Day Audio', NULL),

  -- Full access features
  ('active', 'dashboard', 'full', -1, 'Dashboard', NULL),
  ('active', 'cancel_audit', 'full', -1, 'Cancel Audit', NULL),
  ('active', 'winback_hq', 'full', -1, 'Winback HQ', NULL),
  ('active', 'renewal_tracking', 'full', -1, 'Renewal Tracking', NULL),
  ('active', 'lqs_tracking', 'full', -1, 'LQS Tracking', NULL),
  ('active', 'sales', 'full', -1, 'Sales Logging', NULL),
  ('active', 'leaderboard', 'full', -1, 'Leaderboard', NULL),
  ('active', 'team_rings', 'full', -1, 'Team Rings', NULL),
  ('active', 'contacts', 'full', -1, 'Contacts', NULL),

  -- ===================
  -- 1-ON-1 CLIENT (Everything Unlimited)
  -- ===================
  ('1on1_client', 'ai_roleplay', 'full', -1, 'AI Sales Roleplay', NULL),
  ('1on1_client', 'scorecard_view', 'full', -1, 'View Scorecards', NULL),
  ('1on1_client', 'scorecard_submit', 'full', -1, 'Submit Scorecard Data', NULL),
  ('1on1_client', 'scorecard_edit', 'full', -1, 'Edit Scorecards', NULL),
  ('1on1_client', 'scorecard_create', 'full', -1, 'Create Scorecards', NULL),
  ('1on1_client', 'scorecard_settings', 'full', -1, 'Scorecard Settings', NULL),
  ('1on1_client', 'training_standard', 'full', -1, 'Standard Playbook Training', NULL),
  ('1on1_client', 'training_manage', 'full', -1, 'Manage Training', NULL),
  ('1on1_client', 'training_agency', 'full', -1, 'Agency Training', NULL),
  ('1on1_client', 'comp_analyzer', 'full', -1, 'Comp Analyzer', NULL),
  ('1on1_client', 'commission_builder', 'full', -1, 'Commission Builder', NULL),
  ('1on1_client', 'bonus_tool', 'full', -1, 'Bonus Tool', NULL),
  ('1on1_client', 'call_efficiency', 'full', -1, 'Call Efficiency Tool', NULL),
  ('1on1_client', 'core4', 'full', -1, 'Core 4 Tracking', NULL),
  ('1on1_client', 'monthly_missions', 'full', -1, 'Monthly Missions', NULL),
  ('1on1_client', 'life_targets', 'full', -1, 'Life Targets', NULL),
  ('1on1_client', 'quarterly_targets', 'full', -1, 'Quarterly Targets', NULL),
  ('1on1_client', '90_day_audio', 'full', -1, '90-Day Audio', NULL),
  ('1on1_client', 'dashboard', 'full', -1, 'Dashboard', NULL),
  ('1on1_client', 'cancel_audit', 'full', -1, 'Cancel Audit', NULL),
  ('1on1_client', 'winback_hq', 'full', -1, 'Winback HQ', NULL),
  ('1on1_client', 'renewal_tracking', 'full', -1, 'Renewal Tracking', NULL),
  ('1on1_client', 'lqs_tracking', 'full', -1, 'LQS Tracking', NULL),
  ('1on1_client', 'sales', 'full', -1, 'Sales Logging', NULL),
  ('1on1_client', 'leaderboard', 'full', -1, 'Leaderboard', NULL),
  ('1on1_client', 'team_rings', 'full', -1, 'Team Rings', NULL),
  ('1on1_client', 'contacts', 'full', -1, 'Contacts', NULL);

-- -----------------------------------------------------------------------------
-- 5. FEATURE USAGE TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS feature_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  period_start DATE NOT NULL,  -- Trial start date or billing period start
  usage_count INT DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agency_id, feature_key, period_start)
);

COMMENT ON TABLE feature_usage IS 'Tracks usage of limited features per agency per period';

CREATE INDEX idx_feature_usage_agency_id ON feature_usage(agency_id);
CREATE INDEX idx_feature_usage_lookup ON feature_usage(agency_id, feature_key, period_start);

-- RLS for feature_usage
ALTER TABLE feature_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their agency feature usage"
  ON feature_usage FOR SELECT
  USING (agency_id IN (
    SELECT agency_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Service role can manage feature usage"
  ON feature_usage FOR ALL
  USING (auth.role() = 'service_role');

-- -----------------------------------------------------------------------------
-- 6. HELPER FUNCTIONS
-- -----------------------------------------------------------------------------

-- Function to increment feature usage and return new count
CREATE OR REPLACE FUNCTION increment_feature_usage(
  p_agency_id UUID,
  p_feature_key TEXT,
  p_period_start DATE DEFAULT NULL
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period_start DATE;
  v_new_count INT;
BEGIN
  -- Use provided period_start or default to first of current month
  v_period_start := COALESCE(p_period_start, date_trunc('month', CURRENT_DATE)::DATE);

  INSERT INTO feature_usage (agency_id, feature_key, period_start, usage_count, last_used_at)
  VALUES (p_agency_id, p_feature_key, v_period_start, 1, NOW())
  ON CONFLICT (agency_id, feature_key, period_start)
  DO UPDATE SET
    usage_count = feature_usage.usage_count + 1,
    last_used_at = NOW(),
    updated_at = NOW()
  RETURNING usage_count INTO v_new_count;

  RETURN v_new_count;
END;
$$;

COMMENT ON FUNCTION increment_feature_usage IS 'Increments usage count for a feature and returns new total';

-- Function to check if a feature can be used (has remaining quota)
CREATE OR REPLACE FUNCTION check_feature_access(
  p_agency_id UUID,
  p_feature_key TEXT
)
RETURNS TABLE (
  can_access BOOLEAN,
  access_type TEXT,
  usage_limit INT,
  current_usage INT,
  remaining INT,
  upgrade_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription_status TEXT;
  v_limit_record RECORD;
  v_current_usage INT;
  v_period_start DATE;
BEGIN
  -- Get agency subscription status
  SELECT COALESCE(a.subscription_status, 'none') INTO v_subscription_status
  FROM agencies a
  WHERE a.id = p_agency_id;

  -- If no subscription, deny access
  IF v_subscription_status IS NULL OR v_subscription_status = 'none' THEN
    RETURN QUERY SELECT
      FALSE::BOOLEAN,
      'none'::TEXT,
      NULL::INT,
      0::INT,
      0::INT,
      'Please subscribe to access this feature.'::TEXT;
    RETURN;
  END IF;

  -- Get feature limit for this status
  SELECT * INTO v_limit_record
  FROM feature_limits fl
  WHERE fl.subscription_status = v_subscription_status
    AND fl.feature_key = p_feature_key;

  -- If no limit defined, deny by default
  IF NOT FOUND THEN
    RETURN QUERY SELECT
      FALSE::BOOLEAN,
      'none'::TEXT,
      NULL::INT,
      0::INT,
      0::INT,
      'Feature not available for your subscription.'::TEXT;
    RETURN;
  END IF;

  -- Handle different access types
  IF v_limit_record.access_type = 'full' THEN
    -- Full access - always allowed
    RETURN QUERY SELECT
      TRUE::BOOLEAN,
      'full'::TEXT,
      v_limit_record.usage_limit,
      0::INT,
      CASE WHEN v_limit_record.usage_limit = -1 THEN 999999 ELSE v_limit_record.usage_limit END,
      NULL::TEXT;
    RETURN;
  ELSIF v_limit_record.access_type = 'none' THEN
    -- No access
    RETURN QUERY SELECT
      FALSE::BOOLEAN,
      'none'::TEXT,
      v_limit_record.usage_limit,
      0::INT,
      0::INT,
      v_limit_record.upgrade_message;
    RETURN;
  ELSIF v_limit_record.access_type = 'limited' THEN
    -- Limited access - check usage
    -- Get period start (trial start or first of month)
    SELECT COALESCE(s.trial_start::DATE, date_trunc('month', CURRENT_DATE)::DATE)
    INTO v_period_start
    FROM subscriptions s
    WHERE s.agency_id = p_agency_id
    ORDER BY s.created_at DESC
    LIMIT 1;

    v_period_start := COALESCE(v_period_start, date_trunc('month', CURRENT_DATE)::DATE);

    -- Get current usage
    SELECT COALESCE(fu.usage_count, 0) INTO v_current_usage
    FROM feature_usage fu
    WHERE fu.agency_id = p_agency_id
      AND fu.feature_key = p_feature_key
      AND fu.period_start = v_period_start;

    v_current_usage := COALESCE(v_current_usage, 0);

    RETURN QUERY SELECT
      (v_current_usage < v_limit_record.usage_limit)::BOOLEAN,
      'limited'::TEXT,
      v_limit_record.usage_limit,
      v_current_usage,
      GREATEST(0, v_limit_record.usage_limit - v_current_usage),
      v_limit_record.upgrade_message;
    RETURN;
  END IF;
END;
$$;

COMMENT ON FUNCTION check_feature_access IS 'Checks if an agency can access a feature based on subscription status and usage limits';

-- Function to sync subscription status to agencies table (called by webhook handler)
CREATE OR REPLACE FUNCTION sync_subscription_status(
  p_stripe_subscription_id TEXT,
  p_status TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id UUID;
BEGIN
  -- Get agency_id from subscription
  SELECT agency_id INTO v_agency_id
  FROM subscriptions
  WHERE stripe_subscription_id = p_stripe_subscription_id;

  IF v_agency_id IS NOT NULL THEN
    -- Update agencies table
    UPDATE agencies
    SET subscription_status = p_status
    WHERE id = v_agency_id;
  END IF;
END;
$$;

COMMENT ON FUNCTION sync_subscription_status IS 'Syncs subscription status from subscriptions table to agencies table';

-- -----------------------------------------------------------------------------
-- 7. UPDATED_AT TRIGGERS
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_feature_usage_updated_at
  BEFORE UPDATE ON feature_usage
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
