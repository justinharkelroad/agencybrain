-- One-time data cleanup for Broussard Agency (America/Chicago) on 2026-02-11.
-- Problem: RingCentral call_events ingest inserted a very large unmatched set
-- that inflated "Entire Agency" call/talk totals.
--
-- Safety: copy deleted rows into an audit table before delete.

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

WITH bounds AS (
  SELECT
    ('2026-02-11'::timestamp AT TIME ZONE 'America/Chicago') AS start_utc,
    ('2026-02-12'::timestamp AT TIME ZONE 'America/Chicago') AS end_utc
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
    ce.raw_payload
  FROM public.call_events ce
  CROSS JOIN bounds b
  WHERE ce.agency_id = 'c7985912-6f5b-42ba-b25e-9f29dda2269c'::uuid
    AND ce.provider = 'ringcentral'
    AND ce.matched_team_member_id IS NULL
    AND ce.call_started_at >= b.start_utc
    AND ce.call_started_at < b.end_utc
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
    'broussard_ringcentral_unmatched_2026_02_11',
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
