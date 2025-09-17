-- Update flattener to normalize blanks and use fallbacks (fixed variable names)
CREATE OR REPLACE FUNCTION public.flatten_quoted_household_details(p_submission uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  sub_rec     RECORD;
  row   jsonb;
  idx   int := 0;
  name_text text;
  ls_id   uuid;
  ls_label text;
  items_q int;
  pols_q  int;
  prem_c  bigint;
BEGIN
  -- Get submission details with agency_id and role via joins
  SELECT 
    s.id, s.team_member_id, s.work_date, s.submission_date, s.payload_json,
    ft.agency_id, tm.role
  INTO sub_rec
  FROM public.submissions s
  JOIN public.form_templates ft ON ft.id = s.form_template_id
  JOIN public.team_members tm ON tm.id = s.team_member_id
  WHERE s.id = p_submission;

  IF sub_rec.id IS NULL THEN RETURN; END IF;

  DELETE FROM public.quoted_household_details WHERE submission_id = sub_rec.id;

  FOR idx IN SELECT generate_series(0, coalesce(jsonb_array_length(sub_rec.payload_json->'quoted_details')-1, -1))
  LOOP
    row := (sub_rec.payload_json->'quoted_details')->idx;
    IF row IS NULL THEN CONTINUE; END IF;

    -- Normalize blanks to NULL and add top-level fallbacks
    name_text := coalesce(
      nullif(row->>'prospect_name',''),
      nullif(row->>'household_name',''),
      nullif(sub_rec.payload_json->>'prospect_name',''),
      nullif(sub_rec.payload_json->>'household','')
    );

    items_q := NULLIF(row->>'items_quoted','')::int;
    pols_q  := NULLIF(row->>'policies_quoted','')::int;
    prem_c  := NULLIF(row->>'premium_potential_cents','')::bigint;

    -- Skip "empty" line-items (no name and no business values)
    IF name_text IS NULL AND COALESCE(items_q,0)=0 AND COALESCE(pols_q,0)=0 AND COALESCE(prem_c,0)=0 THEN
      CONTINUE;
    END IF;

    -- Lead source id/label normalization
    ls_id    := NULLIF(row->>'lead_source_id','')::uuid;
    ls_label := NULLIF(row->>'lead_source_label','');
    IF ls_label IS NULL AND ls_id IS NOT NULL THEN
      SELECT name INTO ls_label FROM public.lead_sources WHERE id = ls_id;
    END IF;
    IF ls_label IS NULL THEN ls_label := 'Undefined'; END IF;

    INSERT INTO public.quoted_household_details(
      submission_id, agency_id, team_member_id, role, created_at, work_date,
      household_name, lead_source_id, lead_source_label,
      items_quoted, policies_quoted, premium_potential_cents, extras
    ) VALUES (
      sub_rec.id, sub_rec.agency_id, sub_rec.team_member_id, sub_rec.role,
      now(), COALESCE(sub_rec.work_date, sub_rec.submission_date),
      COALESCE(name_text, 'Unknown'),
      ls_id, ls_label,
      items_q, pols_q, prem_c, row
    );
  END LOOP;
END;
$$;

-- Targeted cleanup backfill for recent submissions with blank/noisy rows
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT q.submission_id
    FROM public.quoted_household_details q
    JOIN public.submissions s ON s.id = q.submission_id
    WHERE s.submission_date >= (CURRENT_DATE - INTERVAL '30 days')
      AND (
        q.household_name IS NULL OR q.household_name='' OR
        (COALESCE(q.items_quoted,0)=0 AND COALESCE(q.policies_quoted,0)=0 AND COALESCE(q.premium_potential_cents,0)=0)
      )
  LOOP
    DELETE FROM public.quoted_household_details WHERE submission_id = r.submission_id;
    PERFORM public.flatten_quoted_household_details(r.submission_id);
  END LOOP;
END$$;