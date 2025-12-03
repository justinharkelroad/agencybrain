-- Fix flatten_quoted_household_details_enhanced: Change FOR loop pattern
-- FROM: FOR v_quoted_detail IN SELECT * FROM jsonb_array_elements(...) with .value access
-- TO: FOR v_current_detail IN SELECT value FROM jsonb_array_elements(...) - direct value

CREATE OR REPLACE FUNCTION public.flatten_quoted_household_details_enhanced(p_submission_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_submission record;
  v_payload jsonb;
  v_quoted_details jsonb;
  v_current_detail jsonb;
  v_records_created integer := 0;
  v_errors text[] := '{}';
  v_agency_id uuid;
  v_team_member_id uuid;
  v_form_template_id uuid;
  v_work_date date;
  v_custom_field record;
BEGIN
  -- Get submission data
  SELECT s.*, ft.field_mappings, ft.agency_id as template_agency_id
  INTO v_submission
  FROM submissions s
  JOIN form_templates ft ON ft.id = s.form_template_id
  WHERE s.id = p_submission_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_message', 'Submission not found',
      'records_created', 0
    );
  END IF;

  v_payload := v_submission.payload_json;
  v_agency_id := v_submission.template_agency_id;
  v_team_member_id := v_submission.team_member_id;
  v_form_template_id := v_submission.form_template_id;
  v_work_date := (v_payload->>'work_date')::date;

  -- Extract quoted_details array from payload
  v_quoted_details := v_payload->'quoted_details';

  IF v_quoted_details IS NULL OR jsonb_array_length(v_quoted_details) = 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'No quoted_details found in payload',
      'records_created', 0
    );
  END IF;

  -- Delete existing records for this submission to allow re-flattening
  DELETE FROM quoted_household_details WHERE submission_id = p_submission_id;

  -- Process each quoted detail - FIXED: SELECT value FROM instead of SELECT * FROM
  FOR v_current_detail IN SELECT value FROM jsonb_array_elements(v_quoted_details)
  LOOP
    DECLARE
      v_prospect_name text;
      v_custom_field_values jsonb := '{}'::jsonb;
      v_lead_source_id uuid;
    BEGIN
      -- v_current_detail already holds the JSON value directly
      v_prospect_name := COALESCE(
        v_current_detail->>'prospect_name',
        v_current_detail->>'name',
        v_current_detail->>'household_name',
        'Unknown'
      );

      -- Look up lead_source_id if lead_source name provided
      IF v_current_detail->>'lead_source' IS NOT NULL THEN
        SELECT id INTO v_lead_source_id
        FROM lead_sources
        WHERE agency_id = v_agency_id
          AND name = v_current_detail->>'lead_source'
        LIMIT 1;
      END IF;

      -- Build custom field values from the detail
      FOR v_custom_field IN 
        SELECT pcf.id, pcf.field_key
        FROM prospect_custom_fields pcf
        WHERE pcf.agency_id = v_agency_id AND pcf.active = true
      LOOP
        IF v_current_detail->>v_custom_field.field_key IS NOT NULL THEN
          v_custom_field_values := v_custom_field_values || 
            jsonb_build_object(v_custom_field.field_key, v_current_detail->>v_custom_field.field_key);
        END IF;
      END LOOP;

      -- Insert the flattened record
      INSERT INTO quoted_household_details (
        submission_id,
        agency_id,
        team_member_id,
        form_template_id,
        work_date,
        household_name,
        zip_code,
        lead_source_id,
        items_quoted,
        policies_quoted,
        premium_potential_cents,
        detailed_notes,
        custom_field_values,
        raw_detail_json
      ) VALUES (
        p_submission_id,
        v_agency_id,
        v_team_member_id,
        v_form_template_id,
        v_work_date,
        v_prospect_name,
        v_current_detail->>'zip_code',
        v_lead_source_id,
        COALESCE((v_current_detail->>'items_quoted')::integer, 0),
        COALESCE((v_current_detail->>'policies_quoted')::integer, 0),
        COALESCE((v_current_detail->>'premium_potential_cents')::integer, 0),
        v_current_detail->>'detailed_notes',
        v_custom_field_values,
        v_current_detail
      );

      v_records_created := v_records_created + 1;

    EXCEPTION WHEN OTHERS THEN
      v_errors := array_append(v_errors, 'Error processing detail: ' || SQLERRM);
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'records_created', v_records_created,
    'errors', v_errors
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error_message', SQLERRM,
    'sql_state', SQLSTATE,
    'records_created', v_records_created
  );
END;
$function$;