-- Phase A: Fix flatten_quoted_household_details function and backfill

-- A1) Update flatten_quoted_household_details function (fixed variable naming)
CREATE OR REPLACE FUNCTION public.flatten_quoted_household_details(p_submission uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  sub_rec RECORD;
  row   jsonb;
  idx   int := 0;
  ls    RECORD;
  ls_id uuid;
  ls_label text;
  items_q int;
  pols_q int;
  prem_c bigint;
  hh_name text;
BEGIN
  SELECT s.id, ft.agency_id, s.team_member_id, ft.role, s.work_date, s.submission_date, s.payload_json
  INTO sub_rec
  FROM public.submissions s
  JOIN public.form_templates ft ON ft.id = s.form_template_id
  WHERE s.id = p_submission;

  IF sub_rec.id IS NULL THEN RETURN; END IF;

  DELETE FROM public.quoted_household_details WHERE submission_id = sub_rec.id;

  FOR idx IN SELECT generate_series(0, coalesce(jsonb_array_length(sub_rec.payload_json->'quoted_details')-1, -1))
  LOOP
    row := (sub_rec.payload_json->'quoted_details')->idx;
    IF row IS NULL THEN CONTINUE; END IF;

    -- Household/prospect name
    hh_name := coalesce(row->>'prospect_name', row->>'household_name', '');

    -- Items/policies (row-level), fallback to 0
    items_q := COALESCE( (row->>'items_quoted')::int, 0 );
    pols_q  := COALESCE( (row->>'policies_quoted')::int, 0 );
    prem_c  := COALESCE( (row->>'premium_potential_cents')::bigint, NULL );

    -- Lead source id/label
    ls_id    := NULLIF(row->>'lead_source_id','')::uuid;
    ls_label := NULLIF(row->>'lead_source_label','');

    IF ls_label IS NULL AND ls_id IS NOT NULL THEN
      SELECT id, name INTO ls FROM public.lead_sources WHERE id = ls_id;
      IF FOUND THEN
        ls_label := ls.name;
      END IF;
    END IF;

    IF ls_label IS NULL THEN
      ls_label := 'Undefined';
    END IF;

    INSERT INTO public.quoted_household_details (
      submission_id, agency_id, team_member_id, role, created_at, work_date,
      household_name, lead_source_id, lead_source_label,
      items_quoted, policies_quoted, premium_potential_cents, extras
    )
    VALUES (
      sub_rec.id, sub_rec.agency_id, sub_rec.team_member_id, sub_rec.role, now(), coalesce(sub_rec.work_date, sub_rec.submission_date),
      hh_name, ls_id, ls_label,
      items_q, pols_q, prem_c, row
    );
  END LOOP;
END;
$$;

-- A2) Re-run the flattener for recent finals (last 30 days)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT id FROM public.submissions
    WHERE final = true AND submission_date >= (CURRENT_DATE - INTERVAL '30 days')
  LOOP
    PERFORM public.flatten_quoted_household_details(r.id);
  END LOOP;
END$$;

-- A3) Optional indexes
CREATE INDEX IF NOT EXISTS idx_qhdet_created_at ON public.quoted_household_details(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qhdet_work_date  ON public.quoted_household_details(work_date DESC);