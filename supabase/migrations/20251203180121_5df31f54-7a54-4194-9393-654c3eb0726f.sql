-- Fix flatten_quoted_household_details_enhanced to use hardcoded keys with fallbacks
-- Drop and recreate the function with fixes

DROP FUNCTION IF EXISTS public.flatten_quoted_household_details_enhanced(uuid);

CREATE OR REPLACE FUNCTION public.flatten_quoted_household_details_enhanced(p_submission_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_submission record;
  v_form_template record;
  v_quoted_mappings jsonb;
  v_quoted_details jsonb;
  v_current_detail jsonb;
  v_household_field text;
  v_lead_source_field text;
  v_items_field text;
  v_policies_field text;
  v_premium_field text;
  v_household_name text;
  v_lead_source text;
  v_items_quoted int;
  v_policies_quoted int;
  v_premium_cents int;
  v_records_created int := 0;
  v_i int;
BEGIN
  -- Get submission with form template
  SELECT s.*, ft.field_mappings, ft.agency_id as template_agency_id
  INTO v_submission
  FROM submissions s
  JOIN form_templates ft ON ft.id = s.form_template_id
  WHERE s.id = p_submission_id;

  IF v_submission IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_message', 'Submission not found');
  END IF;

  -- Get quoted_details mappings from field_mappings
  v_quoted_mappings := v_submission.field_mappings->'quoted_details';

  -- HARDCODE: Always use 'quoted_details' as the payload key (not dynamic)
  v_quoted_details := v_submission.payload_json->'quoted_details';

  IF v_quoted_details IS NULL OR jsonb_array_length(v_quoted_details) = 0 THEN
    RETURN jsonb_build_object('success', true, 'records_created', 0, 'message', 'No quoted_details in payload');
  END IF;

  -- Get field mappings with FALLBACKS for known field names
  v_household_field := COALESCE(v_quoted_mappings->>'household_name', 'prospect_name');
  v_lead_source_field := COALESCE(v_quoted_mappings->>'lead_source', 'lead_source_label');
  v_items_field := v_quoted_mappings->>'items_quoted';
  v_policies_field := v_quoted_mappings->>'policies_quoted';
  v_premium_field := v_quoted_mappings->>'premium_potential_cents';

  -- Delete existing records for this submission
  DELETE FROM quoted_household_details WHERE submission_id = p_submission_id;

  -- Process each quoted detail
  FOR v_i IN 0..jsonb_array_length(v_quoted_details) - 1 LOOP
    v_current_detail := v_quoted_details->v_i;

    -- Extract values using mapped field names (with fallbacks applied)
    v_household_name := v_current_detail->>v_household_field;
    v_lead_source := v_current_detail->>v_lead_source_field;

    -- Extract numeric values with NULL safety
    IF v_items_field IS NOT NULL THEN
      v_items_quoted := COALESCE((v_current_detail->>v_items_field)::int, 0);
    ELSE
      v_items_quoted := 0;
    END IF;

    IF v_policies_field IS NOT NULL THEN
      v_policies_quoted := COALESCE((v_current_detail->>v_policies_field)::int, 0);
    ELSE
      v_policies_quoted := 0;
    END IF;

    IF v_premium_field IS NOT NULL AND v_current_detail->>v_premium_field IS NOT NULL THEN
      -- Handle decimal values: cast to numeric first, multiply by 100, round, then to int
      v_premium_cents := COALESCE(ROUND((v_current_detail->>v_premium_field)::numeric * 100)::int, 0);
    ELSE
      v_premium_cents := 0;
    END IF;

    -- Insert into quoted_household_details
    INSERT INTO quoted_household_details (
      submission_id,
      agency_id,
      team_member_id,
      work_date,
      household_name,
      lead_source,
      items_quoted,
      policies_quoted,
      premium_potential_cents
    ) VALUES (
      p_submission_id,
      v_submission.template_agency_id,
      v_submission.team_member_id,
      COALESCE(v_submission.work_date, v_submission.submission_date),
      v_household_name,
      v_lead_source,
      v_items_quoted,
      v_policies_quoted,
      v_premium_cents
    );

    v_records_created := v_records_created + 1;
  END LOOP;

  -- Log to audit table
  INSERT INTO field_mapping_audit (
    submission_id,
    form_template_id,
    agency_id,
    mappings_used,
    items_extracted,
    policies_extracted,
    premium_extracted
  ) VALUES (
    p_submission_id,
    v_submission.form_template_id,
    v_submission.template_agency_id,
    v_quoted_mappings IS NOT NULL,
    v_items_quoted,
    v_policies_quoted,
    v_premium_cents
  );

  RETURN jsonb_build_object('success', true, 'records_created', v_records_created);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error_message', SQLERRM,
    'sql_state', SQLSTATE
  );
END;
$function$;