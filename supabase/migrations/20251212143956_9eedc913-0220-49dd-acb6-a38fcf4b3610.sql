-- Add missing columns to agency_calls table
ALTER TABLE agency_calls 
ADD COLUMN IF NOT EXISTS audio_storage_path TEXT,
ADD COLUMN IF NOT EXISTS original_filename TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'transcribed';

-- Function to increment call usage (using billing period pattern)
CREATE OR REPLACE FUNCTION increment_call_usage(
  p_agency_id UUID,
  p_month DATE
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  period_start DATE;
  period_end DATE;
BEGIN
  -- Calculate billing period (first and last day of month)
  period_start := date_trunc('month', p_month)::date;
  period_end := (date_trunc('month', p_month) + interval '1 month' - interval '1 day')::date;
  
  INSERT INTO call_usage_tracking (agency_id, billing_period_start, billing_period_end, calls_used, calls_limit)
  VALUES (p_agency_id, period_start, period_end, 1, 20)
  ON CONFLICT (agency_id, billing_period_start)
  DO UPDATE SET 
    calls_used = call_usage_tracking.calls_used + 1;
END;
$$;

-- Add unique constraint for upsert to work (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'call_usage_tracking_agency_period_unique'
  ) THEN
    ALTER TABLE call_usage_tracking 
    ADD CONSTRAINT call_usage_tracking_agency_period_unique 
    UNIQUE (agency_id, billing_period_start);
  END IF;
END $$;