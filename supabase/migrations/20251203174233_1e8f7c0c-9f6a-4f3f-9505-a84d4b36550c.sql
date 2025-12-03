-- Fix flatten_quoted_household_details_enhanced: 3 bugs
-- Bug 1: payload -> payload_json
-- Bug 2: quotedDetails -> quoted_details  
-- Bug 3: SELECT * -> SELECT value in FOR loop

CREATE OR REPLACE FUNCTION public.flatten_quoted_household_details_enhanced(p_submission_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_submission RECORD;
  v_payload jsonb;
  v_quoted_details jsonb;
  v_current_detail jsonb;
  v_field_mappings jsonb;
  v_quoted_mappings jsonb;
  v_items_field text;
  v_policies_field text;
  v_premium_field text;
  v_items_quoted integer;
  v_policies_quoted integer;
  v_premium_cents integer;
  v_records_created integer := 0;
  v_errors jsonb := '[]'::jsonb;
BEGIN
  -- Get submission with form template info
  SELECT 
    s.id,
    s.payload_json,
    s.work_date,
    s.submission_date,
    s.team_member_id,
    s.form_template_id,
    ft.agency_id,
    ft.field_mappings,
    tm.role,
    tm.name as team_member_name
  INTO v_submission
  FROM submissions s
  JOIN form_templates ft ON ft.id = s.form_template_id
  LEFT JOIN team_members tm ON tm.id = s.team_member_id
  WHERE s.id = p_submission_id;

  IF v_submission IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_message', 'Submission not found');
  END IF;

  v_payload := v_submission.payload_json;
  IF v_payload IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_message', 'No payload_json in submission');
  END IF;

  -- Get quoted_details array (snake_case!)
  v_quoted_details := v_payload->'quoted_details';
  IF v_quoted_details IS NULL OR jsonb_array_length(v_quoted_details) = 0 THEN
    RETURN jsonb_build_object('success', true, 'records_created', 0, 'message', 'No quoted_details found');
  END IF;

  -- Get field mappings from form template
  v_field_mappings := v_submission.field_mappings;
  IF v_field_mappings IS NOT NULL THEN
    v_quoted_mappings := v_field_mappings->'quoted_details';
    IF v_quoted_mappings IS NOT NULL THEN
      v_items_field := v_quoted_mappings->>'items_quoted';
      v_policies_field := v_quoted_mappings->>'policies_quoted';
      v_premium_field := v_quoted_mappings->>'premium_potential';
    END IF;
  END IF;

  -- Delete existing records for this submission
  DELETE FROM quoted_household_details WHERE submission_id = p_submission_id;

  -- Process each quoted detail (SELECT value, not SELECT *)
  FOR v_current_detail IN SELECT value FROM jsonb_array_elements(v_quoted_details)
  LOOP
    -- Extract items_quoted using field mapping or direct field
    IF v_items_field IS NOT NULL AND v_current_detail ? v_items_field THEN
      v_items_quoted := COALESCE((v_current_detail->>v_items_field)::integer, 0);
    ELSIF v_current_detail ? 'items_quoted' THEN
      v_items_quoted := COALESCE((v_current_detail->>'items_quoted')::integer, 0);
    ELSE
      v_items_quoted := 0;
    END IF;

    -- Extract policies_quoted using field mapping or direct field
    IF v_policies_field IS NOT NULL AND v_current_detail ? v_policies_field THEN
      v_policies_quoted := COALESCE((v_current_detail->>v_policies_field)::integer, 0);
    ELSIF v_current_detail ? 'policies_quoted' THEN
      v_policies_quoted := COALESCE((v_current_detail->>'policies_quoted')::integer, 0);
    ELSE
      v_policies_quoted := 0;
    END IF;

    -- Extract premium using field mapping or direct field (convert dollars to cents)
    IF v_premium_field IS NOT NULL AND v_current_detail ? v_premium_field THEN
      v_premium_cents := COALESCE((v_current_detail->>v_premium_field)::numeric * 100, 0)::integer;
    ELSIF v_current_detail ? 'premium_potential' THEN
      v_premium_cents := COALESCE((v_current_detail->>'premium_potential')::numeric * 100, 0)::integer;
    ELSIF v_current_detail ? 'premium_potential_cents' THEN
      v_premium_cents := COALESCE((v_current_detail->>'premium_potential_cents')::integer, 0);
    ELSE
      v_premium_cents := 0;
    END IF;

    -- Insert the flattened record
    INSERT INTO quoted_household_details (
      submission_id,
      agency_id,
      team_member_id,
      work_date,
      household_name,
      items_quoted,
      policies_quoted,
      premium_potential_cents,
      lead_source_id,
      role,
      lead_source_label,
      extras
    ) VALUES (
      p_submission_id,
      v_submission.agency_id,
      v_submission.team_member_id,
      COALESCE(v_submission.work_date, v_submission.submission_date::date),
      COALESCE(v_current_detail->>'prospect_name', v_current_detail->>'household_name', 'Unknown'),
      v_items_quoted,
      v_policies_quoted,
      v_premium_cents,
      (v_current_detail->>'lead_source_id')::uuid,
      v_submission.role,
      v_current_detail->>'lead_source_label',
      jsonb_build_object(
        'detailed_notes', v_current_detail->>'detailed_notes',
        'custom_fields', COALESCE(v_current_detail->'custom_fields', '{}'::jsonb),
        'raw_json', v_current_detail
      )
    );

    v_records_created := v_records_created + 1;
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
    'sql_state', SQLSTATE
  );
END;
$$;