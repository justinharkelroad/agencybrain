-- 1. Add global flag to templates
ALTER TABLE call_scoring_templates 
ADD COLUMN IF NOT EXISTS is_global BOOLEAN DEFAULT false;

-- 2. Create agency call scoring settings table
CREATE TABLE IF NOT EXISTS agency_call_scoring_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE UNIQUE,
  enabled BOOLEAN DEFAULT false,
  calls_limit INTEGER DEFAULT 20,
  reset_day INTEGER DEFAULT 1 CHECK (reset_day >= 1 AND reset_day <= 28),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Update call_usage_tracking to track period properly
ALTER TABLE call_usage_tracking 
ADD COLUMN IF NOT EXISTS period_start DATE,
ADD COLUMN IF NOT EXISTS period_end DATE,
ADD COLUMN IF NOT EXISTS reset_day INTEGER DEFAULT 1;

-- 4. Enable RLS
ALTER TABLE agency_call_scoring_settings ENABLE ROW LEVEL SECURITY;

-- 5. RLS policies for agency_call_scoring_settings
CREATE POLICY "Admins can manage all call scoring settings"
ON agency_call_scoring_settings FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Agency owners can view their settings"
ON agency_call_scoring_settings FOR SELECT
TO authenticated
USING (
  agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid())
);

-- 6. Function to check and reset usage if needed
CREATE OR REPLACE FUNCTION check_and_reset_call_usage(
  p_agency_id UUID
)
RETURNS TABLE(calls_used INTEGER, calls_limit INTEGER, period_end DATE, should_reset BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings RECORD;
  v_usage RECORD;
  v_current_period_start DATE;
  v_current_period_end DATE;
  v_today DATE := CURRENT_DATE;
  v_reset_day INTEGER;
BEGIN
  -- Get agency settings
  SELECT * INTO v_settings 
  FROM agency_call_scoring_settings 
  WHERE agency_id = p_agency_id;
  
  IF v_settings IS NULL THEN
    -- No settings, return defaults
    RETURN QUERY SELECT 0, 20, (DATE_TRUNC('month', v_today) + INTERVAL '1 month')::DATE, false;
    RETURN;
  END IF;
  
  v_reset_day := COALESCE(v_settings.reset_day, 1);
  
  -- Calculate current period based on reset_day
  IF EXTRACT(DAY FROM v_today) >= v_reset_day THEN
    v_current_period_start := DATE_TRUNC('month', v_today)::DATE + (v_reset_day - 1);
    v_current_period_end := (DATE_TRUNC('month', v_today) + INTERVAL '1 month')::DATE + (v_reset_day - 1);
  ELSE
    v_current_period_start := (DATE_TRUNC('month', v_today) - INTERVAL '1 month')::DATE + (v_reset_day - 1);
    v_current_period_end := DATE_TRUNC('month', v_today)::DATE + (v_reset_day - 1);
  END IF;
  
  -- Get or create usage record for current period
  SELECT * INTO v_usage
  FROM call_usage_tracking
  WHERE call_usage_tracking.agency_id = p_agency_id
    AND call_usage_tracking.period_start = v_current_period_start;
  
  IF v_usage IS NULL THEN
    -- Create new period record (this effectively resets the count)
    INSERT INTO call_usage_tracking (agency_id, calls_used, calls_limit, period_start, period_end, reset_day, billing_period_start, billing_period_end)
    VALUES (p_agency_id, 0, v_settings.calls_limit, v_current_period_start, v_current_period_end, v_reset_day, v_current_period_start, v_current_period_end)
    RETURNING * INTO v_usage;
    
    RETURN QUERY SELECT v_usage.calls_used, v_usage.calls_limit, v_usage.period_end, true;
  ELSE
    RETURN QUERY SELECT v_usage.calls_used, v_usage.calls_limit, v_usage.period_end, false;
  END IF;
END;
$$;

-- 7. Update the increment function to work with periods
CREATE OR REPLACE FUNCTION increment_call_usage(
  p_agency_id UUID,
  p_month DATE DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings RECORD;
  v_today DATE := CURRENT_DATE;
  v_reset_day INTEGER;
  v_current_period_start DATE;
  v_current_period_end DATE;
BEGIN
  -- Get agency settings
  SELECT * INTO v_settings 
  FROM agency_call_scoring_settings 
  WHERE agency_id = p_agency_id;
  
  v_reset_day := COALESCE(v_settings.reset_day, 1);
  
  -- Calculate current period
  IF EXTRACT(DAY FROM v_today) >= v_reset_day THEN
    v_current_period_start := DATE_TRUNC('month', v_today)::DATE + (v_reset_day - 1);
    v_current_period_end := (DATE_TRUNC('month', v_today) + INTERVAL '1 month')::DATE + (v_reset_day - 1);
  ELSE
    v_current_period_start := (DATE_TRUNC('month', v_today) - INTERVAL '1 month')::DATE + (v_reset_day - 1);
    v_current_period_end := DATE_TRUNC('month', v_today)::DATE + (v_reset_day - 1);
  END IF;
  
  -- Upsert usage record
  INSERT INTO call_usage_tracking (agency_id, calls_used, calls_limit, period_start, period_end, reset_day, billing_period_start, billing_period_end)
  VALUES (
    p_agency_id, 
    1, 
    COALESCE(v_settings.calls_limit, 20), 
    v_current_period_start, 
    v_current_period_end, 
    v_reset_day,
    v_current_period_start,
    v_current_period_end
  )
  ON CONFLICT (agency_id, billing_period_start)
  DO UPDATE SET 
    calls_used = call_usage_tracking.calls_used + 1;
END;
$$;