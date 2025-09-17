-- Update flattener to handle both camelCase (old) and snake_case (new) formats
CREATE OR REPLACE FUNCTION public.flatten_quoted_household_details(p_submission uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  sub_rec     RECORD;
  quoted_array jsonb;
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

  -- Check for both quoted_details (new) and quotedDetails (old) formats
  quoted_array := COALESCE(
    sub_rec.payload_json->'quoted_details',
    sub_rec.payload_json->'quotedDetails'
  );

  -- If no quoted array found, skip processing
  IF quoted_array IS NULL THEN RETURN; END IF;

  FOR idx IN SELECT generate_series(0, coalesce(jsonb_array_length(quoted_array)-1, -1))
  LOOP
    row := quoted_array->idx;
    IF row IS NULL THEN CONTINUE; END IF;

    -- Normalize blanks to NULL and add top-level fallbacks
    -- Check both old and new field names
    name_text := coalesce(
      nullif(row->>'prospect_name',''),
      nullif(row->>'household_name',''),
      nullif(row->>'prospectName',''),    -- old camelCase format
      nullif(row->>'householdName',''),   -- old camelCase format
      nullif(sub_rec.payload_json->>'prospect_name',''),
      nullif(sub_rec.payload_json->>'prospectName',''),  -- old camelCase format
      nullif(sub_rec.payload_json->>'household','')
    );

    -- Handle both old and new field names for metrics
    items_q := COALESCE(
      NULLIF(row->>'items_quoted','')::int,
      NULLIF(row->>'itemsQuoted','')::int  -- old camelCase format
    );
    pols_q := COALESCE(
      NULLIF(row->>'policies_quoted','')::int,
      NULLIF(row->>'policiesQuoted','')::int  -- old camelCase format
    );
    prem_c := COALESCE(
      NULLIF(row->>'premium_potential_cents','')::bigint,
      NULLIF(row->>'premiumPotentialCents','')::bigint  -- old camelCase format
    );

    -- Skip "empty" line-items (no name and no business values)
    IF name_text IS NULL AND COALESCE(items_q,0)=0 AND COALESCE(pols_q,0)=0 AND COALESCE(prem_c,0)=0 THEN
      CONTINUE;
    END IF;

    -- Lead source id/label normalization (handle both formats)
    ls_id := COALESCE(
      NULLIF(row->>'lead_source_id','')::uuid,
      NULLIF(row->>'leadSourceId','')::uuid  -- old camelCase format
    );
    ls_label := COALESCE(
      NULLIF(row->>'lead_source_label',''),
      NULLIF(row->>'leadSourceLabel',''),    -- old camelCase format
      NULLIF(row->>'leadSource','')          -- even older format
    );
    
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

-- Comprehensive backfill from August 1st onwards to restore historical data
DO $$
DECLARE 
  r RECORD;
  processed_count INT := 0;
BEGIN
  RAISE NOTICE 'Starting comprehensive backfill from August 1st...';
  
  FOR r IN
    SELECT DISTINCT s.id as submission_id
    FROM public.submissions s
    JOIN public.form_templates ft ON ft.id = s.form_template_id
    WHERE s.submission_date >= '2024-08-01'
      AND s.final = true
    ORDER BY s.submission_date DESC
  LOOP
    -- Delete existing records and re-process
    DELETE FROM public.quoted_household_details WHERE submission_id = r.submission_id;
    PERFORM public.flatten_quoted_household_details(r.submission_id);
    
    processed_count := processed_count + 1;
    
    -- Log progress every 100 submissions
    IF processed_count % 100 = 0 THEN
      RAISE NOTICE 'Processed % submissions...', processed_count;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Backfill complete! Processed % total submissions from August onwards', processed_count;
END$$;