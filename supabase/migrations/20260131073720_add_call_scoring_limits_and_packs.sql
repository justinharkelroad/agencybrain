-- =============================================================================
-- CALL SCORING LIMITS & IN-APP CALL PACKS
-- =============================================================================
-- Adds:
-- 1. Call scoring feature limits (3 trial, 20 paid, unlimited 1-on-1)
-- 2. call_packs table for purchasable add-on packs
-- 3. agency_call_balance table to track available calls
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ADD CALL SCORING FEATURE LIMITS
-- -----------------------------------------------------------------------------
INSERT INTO feature_limits (subscription_status, feature_key, access_type, usage_limit, description, upgrade_message) VALUES
  -- Trial: 3 call scores to test the feature
  ('trialing', 'call_scoring', 'limited', 3, 'AI Call Scoring', 'You''ve used your 3 trial call scores. Upgrade to get 20 calls/month.'),

  -- Paid: 20 call scores per month
  ('active', 'call_scoring', 'limited', 20, 'AI Call Scoring', 'You''ve used all 20 call scores this month. Purchase additional call packs to continue.'),

  -- 1-on-1: Unlimited
  ('1on1_client', 'call_scoring', 'full', -1, 'AI Call Scoring', NULL)
ON CONFLICT (subscription_status, feature_key) DO UPDATE SET
  access_type = EXCLUDED.access_type,
  usage_limit = EXCLUDED.usage_limit,
  description = EXCLUDED.description,
  upgrade_message = EXCLUDED.upgrade_message;

-- -----------------------------------------------------------------------------
-- 2. CALL PACKS TABLE (Purchasable Add-Ons)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS call_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  call_count INT NOT NULL,
  price_cents INT NOT NULL,  -- Price in cents (e.g., 4900 = $49.00)
  stripe_price_id TEXT,      -- Stripe price ID for one-time purchase
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE call_packs IS 'Available call scoring packs for purchase';

-- Seed default call packs
INSERT INTO call_packs (name, description, call_count, price_cents, sort_order) VALUES
  ('10 Call Pack', 'Add 10 call scores to your account', 10, 4900, 1),
  ('25 Call Pack', 'Add 25 call scores to your account', 25, 9900, 2),
  ('50 Call Pack', 'Add 50 call scores to your account', 50, 17900, 3);

-- RLS for call_packs (public read)
ALTER TABLE call_packs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active call packs"
  ON call_packs FOR SELECT
  USING (is_active = TRUE);

-- -----------------------------------------------------------------------------
-- 3. AGENCY CALL BALANCE TABLE
-- -----------------------------------------------------------------------------
-- Tracks both subscription calls (reset monthly) and purchased pack calls
CREATE TABLE IF NOT EXISTS agency_call_balance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE UNIQUE,

  -- Subscription-based calls (reset each billing period)
  subscription_calls_used INT DEFAULT 0,
  subscription_calls_limit INT DEFAULT 0,  -- 0 for trial/none, 20 for active, NULL for unlimited
  subscription_period_start DATE,

  -- Purchased pack calls (don't reset, carry forward until used)
  purchased_calls_remaining INT DEFAULT 0,

  -- Totals for quick access
  total_calls_used_all_time INT DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE agency_call_balance IS 'Tracks call scoring balance per agency';
COMMENT ON COLUMN agency_call_balance.subscription_calls_used IS 'Calls used from monthly subscription allowance';
COMMENT ON COLUMN agency_call_balance.purchased_calls_remaining IS 'Calls remaining from purchased packs (never expire)';

CREATE INDEX idx_agency_call_balance_agency_id ON agency_call_balance(agency_id);

-- RLS for agency_call_balance
ALTER TABLE agency_call_balance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their agency call balance"
  ON agency_call_balance FOR SELECT
  USING (agency_id IN (
    SELECT agency_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Service role can manage call balance"
  ON agency_call_balance FOR ALL
  USING (auth.role() = 'service_role');

-- -----------------------------------------------------------------------------
-- 4. CALL PACK PURCHASES TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS call_pack_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  call_pack_id UUID REFERENCES call_packs(id),
  stripe_payment_intent_id TEXT,
  stripe_invoice_id TEXT,
  call_count INT NOT NULL,
  price_cents INT NOT NULL,
  status TEXT DEFAULT 'pending',  -- pending, completed, failed, refunded
  purchased_by UUID REFERENCES profiles(id),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE call_pack_purchases IS 'History of call pack purchases';

CREATE INDEX idx_call_pack_purchases_agency_id ON call_pack_purchases(agency_id);

-- RLS for call_pack_purchases
ALTER TABLE call_pack_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their agency purchases"
  ON call_pack_purchases FOR SELECT
  USING (agency_id IN (
    SELECT agency_id FROM profiles WHERE id = auth.uid()
  ));

-- -----------------------------------------------------------------------------
-- 5. HELPER FUNCTIONS FOR CALL SCORING
-- -----------------------------------------------------------------------------

-- Check if agency can score a call (has available balance)
CREATE OR REPLACE FUNCTION check_call_scoring_access(p_agency_id UUID)
RETURNS TABLE (
  can_score BOOLEAN,
  subscription_remaining INT,
  purchased_remaining INT,
  total_remaining INT,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance RECORD;
  v_status TEXT;
  v_is_unlimited BOOLEAN;
BEGIN
  -- Get subscription status
  SELECT subscription_status INTO v_status
  FROM agencies WHERE id = p_agency_id;

  -- Check if unlimited (1-on-1 client)
  v_is_unlimited := (v_status = '1on1_client');

  IF v_is_unlimited THEN
    RETURN QUERY SELECT
      TRUE,
      999999::INT,
      0::INT,
      999999::INT,
      'Unlimited call scoring'::TEXT;
    RETURN;
  END IF;

  -- Get or create balance record
  INSERT INTO agency_call_balance (agency_id, subscription_calls_limit)
  VALUES (p_agency_id, CASE WHEN v_status = 'active' THEN 20 WHEN v_status = 'trialing' THEN 3 ELSE 0 END)
  ON CONFLICT (agency_id) DO NOTHING;

  SELECT * INTO v_balance
  FROM agency_call_balance
  WHERE agency_id = p_agency_id;

  -- Calculate remaining
  DECLARE
    v_sub_remaining INT;
    v_total INT;
  BEGIN
    v_sub_remaining := GREATEST(0, COALESCE(v_balance.subscription_calls_limit, 0) - COALESCE(v_balance.subscription_calls_used, 0));
    v_total := v_sub_remaining + COALESCE(v_balance.purchased_calls_remaining, 0);

    RETURN QUERY SELECT
      (v_total > 0),
      v_sub_remaining,
      COALESCE(v_balance.purchased_calls_remaining, 0),
      v_total,
      CASE
        WHEN v_total > 0 THEN format('%s calls remaining', v_total)
        WHEN v_status = 'trialing' THEN 'Trial call scores used. Upgrade to continue.'
        ELSE 'No calls remaining. Purchase a call pack to continue.'
      END;
  END;
END;
$$;

-- Use a call score (decrements balance)
CREATE OR REPLACE FUNCTION use_call_score(p_agency_id UUID)
RETURNS TABLE (
  success BOOLEAN,
  remaining INT,
  source TEXT,  -- 'subscription' or 'purchased'
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance RECORD;
  v_status TEXT;
  v_sub_remaining INT;
BEGIN
  -- Get subscription status
  SELECT subscription_status INTO v_status
  FROM agencies WHERE id = p_agency_id;

  -- Unlimited for 1-on-1
  IF v_status = '1on1_client' THEN
    -- Just track usage for stats
    UPDATE agency_call_balance
    SET total_calls_used_all_time = total_calls_used_all_time + 1,
        updated_at = NOW()
    WHERE agency_id = p_agency_id;

    RETURN QUERY SELECT TRUE, 999999::INT, 'unlimited'::TEXT, 'Call scored'::TEXT;
    RETURN;
  END IF;

  -- Get balance
  SELECT * INTO v_balance
  FROM agency_call_balance
  WHERE agency_id = p_agency_id
  FOR UPDATE;  -- Lock row

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 0::INT, 'none'::TEXT, 'No call balance found'::TEXT;
    RETURN;
  END IF;

  v_sub_remaining := GREATEST(0, COALESCE(v_balance.subscription_calls_limit, 0) - COALESCE(v_balance.subscription_calls_used, 0));

  -- First use subscription calls
  IF v_sub_remaining > 0 THEN
    UPDATE agency_call_balance
    SET subscription_calls_used = subscription_calls_used + 1,
        total_calls_used_all_time = total_calls_used_all_time + 1,
        updated_at = NOW()
    WHERE agency_id = p_agency_id;

    RETURN QUERY SELECT
      TRUE,
      (v_sub_remaining - 1 + COALESCE(v_balance.purchased_calls_remaining, 0))::INT,
      'subscription'::TEXT,
      'Call scored from monthly allowance'::TEXT;
    RETURN;
  END IF;

  -- Then use purchased calls
  IF COALESCE(v_balance.purchased_calls_remaining, 0) > 0 THEN
    UPDATE agency_call_balance
    SET purchased_calls_remaining = purchased_calls_remaining - 1,
        total_calls_used_all_time = total_calls_used_all_time + 1,
        updated_at = NOW()
    WHERE agency_id = p_agency_id;

    RETURN QUERY SELECT
      TRUE,
      (v_balance.purchased_calls_remaining - 1)::INT,
      'purchased'::TEXT,
      'Call scored from purchased pack'::TEXT;
    RETURN;
  END IF;

  -- No calls available
  RETURN QUERY SELECT
    FALSE,
    0::INT,
    'none'::TEXT,
    CASE
      WHEN v_status = 'trialing' THEN 'Trial calls used. Upgrade to continue scoring calls.'
      ELSE 'No calls remaining. Purchase a call pack.'
    END;
END;
$$;

-- Add purchased calls to balance
CREATE OR REPLACE FUNCTION add_purchased_calls(
  p_agency_id UUID,
  p_call_count INT,
  p_purchase_id UUID DEFAULT NULL
)
RETURNS INT  -- Returns new total purchased remaining
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance INT;
BEGIN
  -- Ensure balance record exists
  INSERT INTO agency_call_balance (agency_id)
  VALUES (p_agency_id)
  ON CONFLICT (agency_id) DO NOTHING;

  -- Add calls
  UPDATE agency_call_balance
  SET purchased_calls_remaining = COALESCE(purchased_calls_remaining, 0) + p_call_count,
      updated_at = NOW()
  WHERE agency_id = p_agency_id
  RETURNING purchased_calls_remaining INTO v_new_balance;

  RETURN v_new_balance;
END;
$$;

-- Reset subscription calls (called at start of billing period)
CREATE OR REPLACE FUNCTION reset_subscription_calls(
  p_agency_id UUID,
  p_new_limit INT,
  p_period_start DATE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO agency_call_balance (agency_id, subscription_calls_used, subscription_calls_limit, subscription_period_start)
  VALUES (p_agency_id, 0, p_new_limit, p_period_start)
  ON CONFLICT (agency_id) DO UPDATE SET
    subscription_calls_used = 0,
    subscription_calls_limit = p_new_limit,
    subscription_period_start = p_period_start,
    updated_at = NOW();
END;
$$;

-- -----------------------------------------------------------------------------
-- 6. TRIGGERS
-- -----------------------------------------------------------------------------
CREATE TRIGGER update_agency_call_balance_updated_at
  BEFORE UPDATE ON agency_call_balance
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_call_packs_updated_at
  BEFORE UPDATE ON call_packs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
