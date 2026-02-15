-- Monitoring helpers for RingCentral unmatched-call anomalies.
-- Default alert threshold:
--   - total_rows >= 500
--   - unmatched_ratio >= 0.90

-- Supporting index for provider/date scans with matched filter.
CREATE INDEX IF NOT EXISTS idx_call_events_provider_started_matched
  ON public.call_events(provider, call_started_at, matched_team_member_id, agency_id);

-- Daily rollup view in UTC for recent trend analysis.
CREATE OR REPLACE VIEW public.vw_ringcentral_unmatched_daily AS
SELECT
  ce.agency_id,
  (ce.call_started_at AT TIME ZONE 'UTC')::date AS day_utc,
  COUNT(*)::bigint AS total_rows,
  COUNT(*) FILTER (WHERE ce.matched_team_member_id IS NULL)::bigint AS unmatched_rows,
  COUNT(*) FILTER (WHERE ce.matched_team_member_id IS NOT NULL)::bigint AS matched_rows,
  ROUND(
    (COUNT(*) FILTER (WHERE ce.matched_team_member_id IS NULL))::numeric
    / NULLIF(COUNT(*), 0),
    4
  ) AS unmatched_ratio
FROM public.call_events ce
WHERE ce.provider = 'ringcentral'
GROUP BY ce.agency_id, (ce.call_started_at AT TIME ZONE 'UTC')::date;

COMMENT ON VIEW public.vw_ringcentral_unmatched_daily IS
  'Daily UTC rollup of RingCentral call_events with matched/unmatched ratios.';

-- Alert-focused RPC with configurable thresholds.
CREATE OR REPLACE FUNCTION public.get_ringcentral_unmatched_alerts(
  p_days integer DEFAULT 14,
  p_min_rows bigint DEFAULT 500,
  p_min_unmatched_ratio numeric DEFAULT 0.9
)
RETURNS TABLE (
  agency_id uuid,
  agency_name text,
  day_utc date,
  total_rows bigint,
  unmatched_rows bigint,
  matched_rows bigint,
  unmatched_ratio numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT
    v.agency_id,
    a.name AS agency_name,
    v.day_utc,
    v.total_rows,
    v.unmatched_rows,
    v.matched_rows,
    v.unmatched_ratio
  FROM public.vw_ringcentral_unmatched_daily v
  JOIN public.agencies a
    ON a.id = v.agency_id
  WHERE v.day_utc >= (CURRENT_DATE - GREATEST(p_days, 1))
    AND v.total_rows >= p_min_rows
    AND v.unmatched_ratio >= p_min_unmatched_ratio
  ORDER BY v.day_utc DESC, v.unmatched_ratio DESC, v.total_rows DESC;
$$;

GRANT SELECT ON public.vw_ringcentral_unmatched_daily TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ringcentral_unmatched_alerts(integer, bigint, numeric) TO authenticated;
