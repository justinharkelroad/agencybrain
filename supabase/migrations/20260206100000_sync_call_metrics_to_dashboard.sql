-- Sync call_metrics_daily → metrics_daily so the dashboard
-- automatically surfaces RingCentral phone data (outbound_calls, talk_minutes).

-- Part 1: Trigger function
CREATE OR REPLACE FUNCTION sync_call_metrics_to_metrics_daily()
RETURNS TRIGGER AS $$
DECLARE
  v_role app_member_role;
BEGIN
  -- metrics_daily.team_member_id is NOT NULL; skip unmatched rows
  IF NEW.team_member_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT role INTO v_role FROM team_members WHERE id = NEW.team_member_id;

  INSERT INTO metrics_daily (
    agency_id, team_member_id, date, role,
    outbound_calls, talk_minutes
  )
  VALUES (
    NEW.agency_id,
    NEW.team_member_id,
    NEW.date,
    COALESCE(v_role, 'Sales'),
    NEW.outbound_calls,
    ROUND(NEW.total_talk_seconds / 60.0)::int
  )
  ON CONFLICT (team_member_id, date) DO UPDATE SET
    outbound_calls = EXCLUDED.outbound_calls,
    talk_minutes   = EXCLUDED.talk_minutes,
    updated_at     = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

CREATE TRIGGER trg_sync_call_metrics
  AFTER INSERT OR UPDATE ON call_metrics_daily
  FOR EACH ROW
  EXECUTE FUNCTION sync_call_metrics_to_metrics_daily();

-- Part 2: Backfill existing data
INSERT INTO metrics_daily (agency_id, team_member_id, date, role, outbound_calls, talk_minutes)
SELECT
  cmd.agency_id,
  cmd.team_member_id,
  cmd.date,
  COALESCE(tm.role, 'Sales'),
  cmd.outbound_calls,
  ROUND(cmd.total_talk_seconds / 60.0)::int
FROM call_metrics_daily cmd
JOIN team_members tm ON tm.id = cmd.team_member_id
WHERE cmd.outbound_calls > 0 OR cmd.total_talk_seconds > 0
ON CONFLICT (team_member_id, date) DO UPDATE SET
  outbound_calls = EXCLUDED.outbound_calls,
  talk_minutes   = EXCLUDED.talk_minutes,
  updated_at     = now();
