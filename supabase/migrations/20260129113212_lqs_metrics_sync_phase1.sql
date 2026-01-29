-- ============================================================================
-- LQS Households → Metrics Daily Sync (Phase 1)
--
-- Purpose: When a quoted household is added via dashboard, automatically
--          increment metrics_daily.quoted_count for the assigned team member.
-- ============================================================================

-- STEP 1: Add skip flag column to prevent double-counting
-- When scorecard sync creates households, it sets this to TRUE so the
-- trigger doesn't increment (scorecard already increments via upsert_metrics_from_submission)

ALTER TABLE lqs_households
ADD COLUMN IF NOT EXISTS skip_metrics_increment boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN lqs_households.skip_metrics_increment IS
  'When true, the metrics increment trigger skips this record. Used by scorecard sync to prevent double-counting.';


-- STEP 2: Create helper function to increment metrics_daily.quoted_count

CREATE OR REPLACE FUNCTION increment_metrics_quoted_count(
  p_agency_id uuid,
  p_team_member_id uuid,
  p_date date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Skip if no team member assigned (metrics_daily.team_member_id is NOT NULL)
  IF p_team_member_id IS NULL THEN
    RAISE LOG 'increment_metrics_quoted_count: Skipping - no team_member_id';
    RETURN;
  END IF;

  -- Upsert: increment quoted_count for this team member on this date
  INSERT INTO metrics_daily (
    agency_id,
    team_member_id,
    date,
    quoted_count
  )
  VALUES (
    p_agency_id,
    p_team_member_id,
    p_date,
    1
  )
  ON CONFLICT (team_member_id, date)
  DO UPDATE SET
    quoted_count = COALESCE(metrics_daily.quoted_count, 0) + 1,
    updated_at = now();

  RAISE LOG 'increment_metrics_quoted_count: Done for team_member=%, date=%', p_team_member_id, p_date;
END;
$$;


-- STEP 3: Create trigger function

CREATE OR REPLACE FUNCTION increment_quoted_count_from_lqs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check skip flag (set by scorecard sync to prevent double-counting)
  IF NEW.skip_metrics_increment = true THEN
    RAISE LOG 'increment_quoted_count_from_lqs: Skipping (flag set) household=%', NEW.id;
    NEW.skip_metrics_increment := false;  -- Reset flag
    RETURN NEW;
  END IF;

  -- Increment when:
  -- 1. New household created with status='quoted', OR
  -- 2. Existing household promoted from 'lead' to 'quoted'

  IF TG_OP = 'INSERT' AND NEW.status = 'quoted' THEN
    PERFORM increment_metrics_quoted_count(
      NEW.agency_id,
      NEW.team_member_id,
      COALESCE(NEW.first_quote_date, CURRENT_DATE)
    );
  ELSIF TG_OP = 'UPDATE'
    AND OLD.status = 'lead'
    AND NEW.status = 'quoted' THEN
    PERFORM increment_metrics_quoted_count(
      NEW.agency_id,
      NEW.team_member_id,
      COALESCE(NEW.first_quote_date, CURRENT_DATE)
    );
  END IF;

  RETURN NEW;
END;
$$;


-- STEP 4: Register the trigger (BEFORE so we can modify skip_metrics_increment)

DROP TRIGGER IF EXISTS lqs_households_update_metrics ON lqs_households;

CREATE TRIGGER lqs_households_update_metrics
  BEFORE INSERT OR UPDATE ON lqs_households
  FOR EACH ROW
  EXECUTE FUNCTION increment_quoted_count_from_lqs();
