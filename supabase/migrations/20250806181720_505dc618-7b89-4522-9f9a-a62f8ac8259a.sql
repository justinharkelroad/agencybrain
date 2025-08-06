-- Phase 1: Database Cleanup and Constraints

-- First, let's identify and clean up duplicate periods
-- Delete duplicate periods keeping only the most recent one for each user per date range
WITH duplicate_periods AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id, start_date, end_date 
           ORDER BY updated_at DESC
         ) as row_num
  FROM periods
)
DELETE FROM periods 
WHERE id IN (
  SELECT id FROM duplicate_periods WHERE row_num > 1
);

-- Add unique constraint to prevent duplicate periods for same user and date range
ALTER TABLE periods 
ADD CONSTRAINT periods_user_date_range_unique 
UNIQUE (user_id, start_date, end_date);

-- Update period status validation to use proper enum-like constraint
ALTER TABLE periods 
DROP CONSTRAINT IF EXISTS periods_status_check;

ALTER TABLE periods 
ADD CONSTRAINT periods_status_check 
CHECK (status IN ('draft', 'active', 'complete'));

-- Add index for better performance on period queries
CREATE INDEX IF NOT EXISTS idx_periods_user_status 
ON periods (user_id, status, updated_at DESC);

-- Add index for better performance on period date queries
CREATE INDEX IF NOT EXISTS idx_periods_user_dates 
ON periods (user_id, start_date, end_date);

-- Create function to prevent overlapping periods for the same user
CREATE OR REPLACE FUNCTION check_period_overlap()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if there's an overlapping period for the same user
  IF EXISTS (
    SELECT 1 FROM periods 
    WHERE user_id = NEW.user_id 
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND (
      (NEW.start_date BETWEEN start_date AND end_date) OR
      (NEW.end_date BETWEEN start_date AND end_date) OR
      (start_date BETWEEN NEW.start_date AND NEW.end_date) OR
      (end_date BETWEEN NEW.start_date AND NEW.end_date)
    )
  ) THEN
    RAISE EXCEPTION 'Period dates overlap with existing period for this user';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to check for overlapping periods
DROP TRIGGER IF EXISTS trigger_check_period_overlap ON periods;
CREATE TRIGGER trigger_check_period_overlap
  BEFORE INSERT OR UPDATE ON periods
  FOR EACH ROW
  EXECUTE FUNCTION check_period_overlap();

-- Function to auto-update period status based on completion
CREATE OR REPLACE FUNCTION update_period_status()
RETURNS TRIGGER AS $$
BEGIN
  -- If form_data has substantial content, mark as complete
  IF NEW.form_data IS NOT NULL AND 
     jsonb_typeof(NEW.form_data) = 'object' AND
     NEW.form_data ? 'sales' AND 
     NEW.form_data ? 'marketing' AND
     NEW.form_data ? 'cashFlow' THEN
    NEW.status = 'complete';
  ELSIF NEW.form_data IS NOT NULL AND 
        jsonb_typeof(NEW.form_data) = 'object' AND
        jsonb_object_keys(NEW.form_data) IS NOT NULL THEN
    NEW.status = 'active';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update status
DROP TRIGGER IF EXISTS trigger_update_period_status ON periods;
CREATE TRIGGER trigger_update_period_status
  BEFORE UPDATE ON periods
  FOR EACH ROW
  EXECUTE FUNCTION update_period_status();