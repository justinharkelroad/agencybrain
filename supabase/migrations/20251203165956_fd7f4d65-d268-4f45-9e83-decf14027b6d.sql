-- Update flatten_quoted_household_details_enhanced to use field_mappings
CREATE OR REPLACE FUNCTION public.flatten_quoted_household_details_enhanced(p_submission_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_submission record;
  v_agency_id uuid;
  v_team_member_id uuid;
  v_role text;
  v_work_date date;
  v_payload jsonb;
  v_quoted_details jsonb;
  v_current_detail jsonb;
  v_field_mappings jsonb;
  v_qd_mappings jsonb;
  v_prospect_name text;
  v_zip_code text;
  v_lead_source_id uuid;
  v_lead_source_label text;
  v_items_quoted int;
  v_policies_quoted int;
  v_premium_cents int;
  v_detailed_notes text;
  v_custom_field_values jsonb;
  v_records_created int := 0;
  v_errors text[] := '{}';
  v_source_field text;
  v_raw_value text;
BEGIN
  -- Get submission with form template info
  SELECT 
    s.id,
    s.form_template_id,
    s.team_member_id,
    s.payload,
    COALESCE(s.work_date, s.submission_date) as effective_date,
    ft.agency_id,
    ft.role::text,
    ft.field_mappings
  INTO v_submission
  FROM submissions s
  JOIN form_templates ft ON ft.id = s.form_template_id
  WHERE s.id = p_submission_id;

  IF v_submission IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Submission not found');
  END IF;

  v_agency_id := v_submission.agency_id;
  v_team_member_id := v_submission.team_member_id;
  v_role := v_submission.role;
  v_work_date := v_submission.effective_date;
  v_payload := v_submission.payload;
  v_field_mappings := v_submission.field_mappings;

  -- Get quoted_details mappings (may be null)
  v_qd_mappings := v_field_mappings->'quoted_details';

  -- Extract quoted details array from payload
  v_quoted_details := v_payload->'quotedDetails';
  
  IF v_quoted_details IS NULL OR jsonb_array_length(v_quoted_details) = 0 THEN
    RETURN jsonb_build_object('success', true, 'records_created', 0, 'message', 'No quoted details found');
  END IF;

  -- Delete existing records for this submission to avoid duplicates
  DELETE FROM quoted_household_details WHERE submission_id = p_submission_id;

  -- Process each quoted detail
  FOR v_current_detail IN SELECT * FROM jsonb_array_elements(v_quoted_details)
  LOOP
    BEGIN
      -- Extract standard fields
      v_prospect_name := v_current_detail->>'prospect_name';
      v_zip_code := v_current_detail->>'zip_code';
      v_lead_source_id := NULLIF(v_current_detail->>'lead_source_id', '')::uuid;
      v_lead_source_label := v_current_detail->>'lead_source_label';
      v_detailed_notes := v_current_detail->>'detailed_notes';

      -- Extract metrics using field_mappings if available
      IF v_qd_mappings IS NOT NULL THEN
        -- items_quoted
        v_source_field := v_qd_mappings->>'items_quoted';
        IF v_source_field IS NOT NULL THEN
          v_raw_value := v_current_detail->>v_source_field;
          v_items_quoted := COALESCE(NULLIF(v_raw_value, '')::numeric, 0)::int;
        ELSE
          v_items_quoted := 0;
        END IF;

        -- policies_quoted
        v_source_field := v_qd_mappings->>'policies_quoted';
        IF v_source_field IS NOT NULL THEN
          v_raw_value := v_current_detail->>v_source_field;
          v_policies_quoted := COALESCE(NULLIF(v_raw_value, '')::numeric, 0)::int;
        ELSE
          v_policies_quoted := 0;
        END IF;

        -- premium_potential_cents
        v_source_field := v_qd_mappings->>'premium_potential_cents';
        IF v_source_field IS NOT NULL THEN
          v_raw_value := v_current_detail->>v_source_field;
          -- Convert dollars to cents if needed (assume input is dollars)
          v_premium_cents := COALESCE(NULLIF(v_raw_value, '')::numeric * 100, 0)::int;
        ELSE
          v_premium_cents := 0;
        END IF;
      ELSE
        -- No mappings - try direct field names as fallback
        v_items_quoted := COALESCE((v_current_detail->>'items_quoted')::int, 0);
        v_policies_quoted := COALESCE((v_current_detail->>'policies_quoted')::int, 0);
        v_premium_cents := COALESCE((v_current_detail->>'premium_potential_cents')::numeric * 100, 0)::int;
      END IF;

      -- Build custom fields object (fields that start with 'field_')
      SELECT jsonb_object_agg(key, value)
      INTO v_custom_field_values
      FROM jsonb_each(v_current_detail)
      WHERE key LIKE 'field_%';

      -- Insert the flattened record
      INSERT INTO quoted_household_details (
        submission_id, agency_id, team_member_id, role, work_date,
        household_name, zip_code, lead_source_id, lead_source_label,
        items_quoted, policies_quoted, premium_potential_cents, extras
      ) VALUES (
        p_submission_id, v_agency_id, v_team_member_id, v_role::app_member_role, v_work_date,
        v_prospect_name, v_zip_code, v_lead_source_id, v_lead_source_label,
        v_items_quoted, v_policies_quoted, v_premium_cents,
        jsonb_build_object(
          'detailed_notes', v_detailed_notes,
          'custom_fields', COALESCE(v_custom_field_values, '{}'::jsonb),
          'raw_json', v_current_detail
        )
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
END;
$function$;