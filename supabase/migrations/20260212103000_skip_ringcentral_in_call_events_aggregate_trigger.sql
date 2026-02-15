-- Prevent RingCentral call_events inserts from overwriting authoritative
-- Users-sheet totals in call_metrics_daily.
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

  -- RingCentral has authoritative summary totals from the Users sheet.
  IF NEW.provider = 'ringcentral' THEN
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
