-- One-time cleanup for extreme unmatched RingCentral day-batches found by diagnostics.
-- Scope is intentionally narrow: specific agency/day tuples only.
-- Day boundaries below are in UTC because the detection query grouped by UTC date.

CREATE TABLE IF NOT EXISTS public.call_events_cleanup_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cleanup_tag text NOT NULL,
  source_call_event_id uuid NOT NULL,
  agency_id uuid NOT NULL,
  provider text NOT NULL,
  external_call_id text NULL,
  matched_team_member_id uuid NULL,
  direction text NULL,
  duration_seconds integer NULL,
  call_started_at timestamptz NULL,
  raw_payload jsonb NULL,
  archived_at timestamptz NOT NULL DEFAULT now()
);

WITH targets AS (
  SELECT '5fcd77e5-b11c-4b9d-8d98-8f2a72050f7c'::uuid AS agency_id, '2026-02-10'::date AS day_utc
  UNION ALL
  SELECT '743ebf2a-33fb-483e-ad07-d09097013850'::uuid, '2026-02-10'::date
  UNION ALL
  SELECT 'c7985912-6f5b-42ba-b25e-9f29dda2269c'::uuid, '2026-02-09'::date
),
to_archive AS (
  SELECT
    ce.id,
    ce.agency_id,
    ce.provider,
    ce.external_call_id,
    ce.matched_team_member_id,
    ce.direction,
    ce.duration_seconds,
    ce.call_started_at,
    ce.raw_payload,
    t.day_utc
  FROM public.call_events ce
  JOIN targets t
    ON t.agency_id = ce.agency_id
  WHERE ce.provider = 'ringcentral'
    AND ce.matched_team_member_id IS NULL
    AND ce.call_started_at >= (t.day_utc::timestamp AT TIME ZONE 'UTC')
    AND ce.call_started_at <  ((t.day_utc + 1)::timestamp AT TIME ZONE 'UTC')
),
archived AS (
  INSERT INTO public.call_events_cleanup_audit (
    cleanup_tag,
    source_call_event_id,
    agency_id,
    provider,
    external_call_id,
    matched_team_member_id,
    direction,
    duration_seconds,
    call_started_at,
    raw_payload
  )
  SELECT
    'ringcentral_extreme_unmatched_utc_days_20260212',
    ta.id,
    ta.agency_id,
    ta.provider,
    ta.external_call_id,
    ta.matched_team_member_id,
    ta.direction,
    ta.duration_seconds,
    ta.call_started_at,
    ta.raw_payload
  FROM to_archive ta
  ON CONFLICT DO NOTHING
  RETURNING source_call_event_id
)
DELETE FROM public.call_events ce
WHERE ce.id IN (SELECT source_call_event_id FROM archived);
