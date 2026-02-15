-- RPC: agency-wide call totals from call_events (includes unmatched calls).
-- Used by the dashboard "Entire Agency" view so owners see ALL calls,
-- not just those matched to a team member via call_metrics_daily.

CREATE OR REPLACE FUNCTION public.get_agency_call_totals_from_events(
  p_agency_id uuid,
  p_date date,
  p_timezone text DEFAULT 'America/New_York'
)
RETURNS TABLE (
  outbound_calls bigint,
  talk_minutes bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT
    COUNT(*) FILTER (WHERE lower(direction) = 'outbound'),
    COALESCE(ROUND(SUM(duration_seconds) / 60.0), 0)::bigint
  FROM call_events
  WHERE agency_id = p_agency_id
    AND call_started_at >= (p_date::timestamp AT TIME ZONE p_timezone)
    AND call_started_at <  ((p_date + 1)::timestamp AT TIME ZONE p_timezone);
$$;

-- Composite index for the agency + date-range lookup pattern above.
CREATE INDEX IF NOT EXISTS idx_call_events_agency_started
  ON call_events(agency_id, call_started_at);
