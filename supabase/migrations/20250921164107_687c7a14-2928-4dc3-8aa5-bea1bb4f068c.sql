-- Phase 2: Enhanced Flattener Function with Semantic Mapping Support
-- Update flatten_quoted_household_details to use field mappings with safety additions

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
  
  -- Field mapping variables
  mappings jsonb;
  map_items text;
  map_pols  text;
  map_prem  text;
  mappings_used boolean := false;
  
  -- Extracted values
  name_text text;
  ls_id   uuid;
  ls_label text;
  items_q int;
  pols_q  int;
  prem_c  bigint;
  
  -- Audit variables
  items_extracted int := 0;
  policies_extracted int := 0;
  premium_extracted bigint := 0;
  
BEGIN
  -- Get submission details with field mappings
  SELECT 
    s.id, s.team_member_id, s.work_date, s.submission_date, s.payload_json,
    ft.agency_id, ft.field_mappings, tm.role, ft.id as form_template_id
  INTO sub_rec
  FROM public.submissions s
  JOIN public.form_templates ft ON ft.id = s.form_template_id
  JOIN public.team_members tm ON tm.id = s.team_member_id
  WHERE s.id = p_submission;

  IF sub_rec.id IS NULL THEN RETURN; END IF;

  -- Extract field mappings
  mappings := COALESCE(sub_rec.field_mappings, '{}'::jsonb);
  map_items := mappings #>> '{repeater,quotedDetails,items_quoted}';
  map_pols  := mappings #>> '{repeater,quotedDetails,policies_quoted}';
  map_prem  := mappings #>> '{repeater,quotedDetails,premium_potential_cents}';

  -- Check if any mappings are defined
  mappings_used := (map_items IS NOT NULL AND map_items <> '') OR 
                   (map_pols IS NOT NULL AND map_pols <> '') OR 
                   (map_prem IS NOT NULL AND map_prem <> '');

  -- DELETE existing records first (idempotent)
  DELETE FROM public.quoted_household_details WHERE submission_id = sub_rec.id;

  -- Check for both quoted_details (new) and quotedDetails (old) formats
  quoted_array := COALESCE(
    sub_rec.payload_json->'quoted_details',
    sub_rec.payload_json->'quotedDetails'
  );

  -- If no quoted array found, skip processing
  IF quoted_array IS NULL THEN
    -- Still log the audit entry
    INSERT INTO public.field_mapping_audit (
      submission_id, form_template_id, agency_id, mappings_used,
      items_extracted, policies_extracted, premium_extracted
    ) VALUES (
      sub_rec.id, sub_rec.form_template_id, sub_rec.agency_id, mappings_used,
      0, 0, 0
    );
    RETURN; 
  END IF;

  FOR idx IN SELECT generate_series(0, coalesce(jsonb_array_length(quoted_array)-1, -1))
  LOOP
    row := quoted_array->idx;
    IF row IS NULL THEN CONTINUE; END IF;

    -- Normalize blanks to NULL and add top-level fallbacks
    name_text := coalesce(
      nullif(row->>'prospect_name',''),
      nullif(row->>'household_name',''),
      nullif(row->>'prospectName',''),    -- old camelCase format
      nullif(row->>'householdName',''),   -- old camelCase format
      nullif(sub_rec.payload_json->>'prospect_name',''),
      nullif(sub_rec.payload_json->>'prospectName',''),  -- old camelCase format
      nullif(sub_rec.payload_json->>'household','')
    );

    -- SAFE TYPE COERCION: Extract items_quoted with mapping fallback
    BEGIN
      IF map_items IS NOT NULL AND map_items <> '' THEN
        items_q := NULLIF(row->>map_items,'')::int;
      ELSE
        -- Fallback to legacy built-in field names
        items_q := COALESCE(
          NULLIF(row->>'items_quoted','')::int,
          NULLIF(row->>'itemsQuoted','')::int  -- old camelCase format
        );
      END IF;
    EXCEPTION WHEN invalid_text_representation THEN
      -- Log warning for non-numeric data but continue processing
      RAISE WARNING 'Invalid numeric value for items_quoted in submission % row %: %', 
        p_submission, idx, COALESCE(row->>map_items, row->>'items_quoted');
      items_q := NULL;
    END;

    -- SAFE TYPE COERCION: Extract policies_quoted with mapping fallback  
    BEGIN
      IF map_pols IS NOT NULL AND map_pols <> '' THEN
        pols_q := NULLIF(row->>map_pols,'')::int;
      ELSE
        -- Fallback to legacy built-in field names
        pols_q := COALESCE(
          NULLIF(row->>'policies_quoted','')::int,
          NULLIF(row->>'policiesQuoted','')::int  -- old camelCase format
        );
      END IF;
    EXCEPTION WHEN invalid_text_representation THEN
      -- Log warning for non-numeric data but continue processing
      RAISE WARNING 'Invalid numeric value for policies_quoted in submission % row %: %', 
        p_submission, idx, COALESCE(row->>map_pols, row->>'policies_quoted');
      pols_q := NULL;
    END;

    -- SAFE TYPE COERCION: Extract premium_potential_cents with mapping fallback
    BEGIN
      IF map_prem IS NOT NULL AND map_prem <> '' THEN
        prem_c := NULLIF(row->>map_prem,'')::bigint;
      ELSE
        -- Fallback to legacy built-in field names
        prem_c := COALESCE(
          NULLIF(row->>'premium_potential_cents','')::bigint,
          NULLIF(row->>'premiumPotentialCents','')::bigint  -- old camelCase format
        );
      END IF;
    EXCEPTION WHEN invalid_text_representation THEN
      -- Log warning for non-numeric data but continue processing
      RAISE WARNING 'Invalid numeric value for premium_potential_cents in submission % row %: %', 
        p_submission, idx, COALESCE(row->>map_prem, row->>'premium_potential_cents');
      prem_c := NULL;
    END;

    -- Skip "empty" line-items (no name and no business values)
    IF name_text IS NULL AND COALESCE(items_q,0)=0 AND COALESCE(pols_q,0)=0 AND COALESCE(prem_c,0)=0 THEN
      CONTINUE;
    END IF;

    -- Accumulate extracted counts for audit
    items_extracted := items_extracted + COALESCE(items_q, 0);
    policies_extracted := policies_extracted + COALESCE(pols_q, 0);
    premium_extracted := premium_extracted + COALESCE(prem_c, 0);

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

  -- AUDIT LOG: Record extraction results for observability
  INSERT INTO public.field_mapping_audit (
    submission_id, form_template_id, agency_id, mappings_used,
    items_extracted, policies_extracted, premium_extracted
  ) VALUES (
    sub_rec.id, sub_rec.form_template_id, sub_rec.agency_id, mappings_used,
    items_extracted, policies_extracted, premium_extracted
  );

  -- Log finalize event for observability (keep for 48h via table cleanup job)
  RAISE NOTICE 'Flattener processed submission %: template=%, mappings_used=%, items=%, policies=%, premium=%', 
    sub_rec.id, sub_rec.form_template_id, mappings_used, items_extracted, policies_extracted, premium_extracted;

END;
$$;

-- Ensure trigger is idempotent and properly placed
-- Replace existing trigger to ensure proper ordering
DROP TRIGGER IF EXISTS submissions_flatten_households ON submissions;
DROP TRIGGER IF EXISTS trigger_flatten_quoted_details ON submissions;

CREATE OR REPLACE FUNCTION trigger_flatten_quoted_details()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only process final submissions and ensure idempotence
  IF NEW.final = true THEN
    -- Wrap in transaction for consistency
    PERFORM flatten_quoted_household_details(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

-- Create the trigger with proper WHEN clause for efficiency
CREATE TRIGGER submissions_flatten_households
  AFTER INSERT OR UPDATE ON public.submissions
  FOR EACH ROW
  WHEN (NEW.final = true)
  EXECUTE FUNCTION trigger_flatten_quoted_details();