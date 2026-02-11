-- Trigger: aggregate call_events into call_metrics_daily on each insert.
-- Closes the gap where Ricochet inserts into call_events but nothing
-- rolls those rows up into call_metrics_daily at the database level.
-- The existing trg_sync_call_metrics on call_metrics_daily then syncs
-- outbound_calls / talk_minutes into metrics_daily automatically.

CREATE OR REPLACE FUNCTION public.aggregate_call_events_to_daily()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_date date;
  v_total_calls      int;
  v_inbound_calls    int;
  v_outbound_calls   int;
  v_answered_calls   int;
  v_missed_calls     int;
  v_total_talk_secs  int;
BEGIN
  -- Only process rows matched to a team member
  IF NEW.matched_team_member_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Derive the calendar date from the call timestamp
  v_date := (COALESCE(NEW.call_started_at, NEW.created_at))::date;

  -- Aggregate all call_events for this (agency, member, date)
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE lower(direction) = 'inbound'),
    COUNT(*) FILTER (WHERE lower(direction) = 'outbound'),
    COUNT(*) FILTER (WHERE result IN ('Answered', 'Connected')
                        OR (result IS NULL AND COALESCE(duration_seconds, 0) > 0)),
    COUNT(*) FILTER (WHERE COALESCE(duration_seconds, 0) = 0),
    COALESCE(SUM(duration_seconds), 0)
  INTO
    v_total_calls,
    v_inbound_calls,
    v_outbound_calls,
    v_answered_calls,
    v_missed_calls,
    v_total_talk_secs
  FROM call_events
  WHERE agency_id = NEW.agency_id
    AND matched_team_member_id = NEW.matched_team_member_id
    AND (COALESCE(call_started_at, created_at))::date = v_date;

  -- Upsert into call_metrics_daily
  INSERT INTO call_metrics_daily (
    agency_id, team_member_id, date,
    total_calls, inbound_calls, outbound_calls,
    answered_calls, missed_calls, total_talk_seconds,
    last_calculated_at, updated_at
  )
  VALUES (
    NEW.agency_id, NEW.matched_team_member_id, v_date,
    v_total_calls, v_inbound_calls, v_outbound_calls,
    v_answered_calls, v_missed_calls, v_total_talk_secs,
    now(), now()
  )
  ON CONFLICT (agency_id, team_member_id, date) DO UPDATE SET
    total_calls        = EXCLUDED.total_calls,
    inbound_calls      = EXCLUDED.inbound_calls,
    outbound_calls     = EXCLUDED.outbound_calls,
    answered_calls     = EXCLUDED.answered_calls,
    missed_calls       = EXCLUDED.missed_calls,
    total_talk_seconds = EXCLUDED.total_talk_seconds,
    last_calculated_at = now(),
    updated_at         = now();

  RETURN NEW;
END;
$$;

-- Fire after insert so the NEW row is visible in the aggregate query
CREATE TRIGGER trg_call_events_aggregate_daily
  AFTER INSERT ON call_events
  FOR EACH ROW
  EXECUTE FUNCTION aggregate_call_events_to_daily();
