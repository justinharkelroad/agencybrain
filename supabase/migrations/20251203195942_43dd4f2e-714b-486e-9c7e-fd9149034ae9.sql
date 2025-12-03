-- Fix column name: lead_source -> lead_source_label in INSERT statement
DROP FUNCTION IF EXISTS flatten_quoted_household_details_enhanced(uuid);

CREATE OR REPLACE FUNCTION flatten_quoted_household_details_enhanced(p_submission_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_submission RECORD;
  v_form_template RECORD;
  v_quoted_mappings jsonb;
  v_quoted_details jsonb;
  v_household_field text;
  v_lead_source_field text;
  v_items_field text;
  v_policies_field text;
  v_premium_field text;
  v_detail jsonb;
  v_records_created int := 0;
BEGIN
  -- Get the submission
  SELECT s.id, s.agency_id, s.team_member_id, s.work_date, s.payload_json, s.form_template_id
  INTO v_submission
  FROM submissions s
  WHERE s.id = p_submission_id AND s.final = true;

  IF v_submission IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_message', 'Submission not found or not final');
  END IF;

  -- Get the form template and its field mappings
  SELECT ft.id, ft.field_mappings
  INTO v_form_template
  FROM form_templates ft
  WHERE ft.id = v_submission.form_template_id;

  IF v_form_template IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_message', 'Form template not found');
  END IF;

  -- Get the quoted_details section of mappings
  v_quoted_mappings := v_form_template.field_mappings->'quoted_details';

  -- HARDCODE: Always use 'quoted_details' as the key to access the payload
  v_quoted_details := v_submission.payload_json->'quoted_details';

  IF v_quoted_details IS NULL OR jsonb_array_length(v_quoted_details) = 0 THEN
    RETURN jsonb_build_object('success', true, 'records_created', 0, 'message', 'No quoted details found in payload');
  END IF;

  -- Get field mappings with FALLBACKS for known field names
  v_household_field := COALESCE(v_quoted_mappings->>'household_name', 'prospect_name');
  v_lead_source_field := COALESCE(v_quoted_mappings->>'lead_source', 'lead_source_label');
  v_items_field := v_quoted_mappings->>'items_quoted';
  v_policies_field := v_quoted_mappings->>'policies_quoted';
  v_premium_field := v_quoted_mappings->>'premium_potential_cents';

  -- Delete existing records for this submission
  DELETE FROM quoted_household_details WHERE submission_id = p_submission_id;

  -- Insert new records from the quoted_details array
  FOR v_detail IN SELECT value FROM jsonb_array_elements(v_quoted_details)
  LOOP
    INSERT INTO quoted_household_details (
      submission_id,
      agency_id,
      team_member_id,
      work_date,
      household_name,
      lead_source_label,
      items_quoted,
      policies_quoted,
      premium_potential_cents
    ) VALUES (
      p_submission_id,
      v_submission.agency_id,
      v_submission.team_member_id,
      v_submission.work_date,
      v_detail.value->>v_household_field,
      v_detail.value->>v_lead_source_field,
      COALESCE((v_detail.value->>v_items_field)::int, 0),
      COALESCE((v_detail.value->>v_policies_field)::int, 0),
      COALESCE((v_detail.value->>v_premium_field)::bigint, 0)
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
    v_submission.agency_id,
    v_quoted_mappings IS NOT NULL,
    v_records_created,
    v_records_created,
    0
  );

  RETURN jsonb_build_object('success', true, 'records_created', v_records_created);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error_message', SQLERRM,
    'sql_state', SQLSTATE
  );
END;
$$;