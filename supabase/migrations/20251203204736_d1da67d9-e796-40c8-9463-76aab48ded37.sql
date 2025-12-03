-- Fix all 3 bugs: JSON path, direct keys, premium * 100
DROP FUNCTION IF EXISTS flatten_quoted_household_details_enhanced(uuid);

CREATE OR REPLACE FUNCTION flatten_quoted_household_details_enhanced(p_submission_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_submission RECORD;
  v_quoted_mappings jsonb;
  v_quoted_details jsonb;
  v_items_field text;
  v_policies_field text;
  v_premium_field text;
  v_detail jsonb;
  v_records_created int := 0;
BEGIN
  -- Get submission WITH agency_id and role from form_templates
  SELECT s.id, ft.agency_id, s.team_member_id, ft.role,
         COALESCE(s.work_date, s.submission_date) as work_date, 
         s.payload_json, s.form_template_id, ft.field_mappings
  INTO v_submission
  FROM submissions s
  JOIN form_templates ft ON ft.id = s.form_template_id
  WHERE s.id = p_submission_id AND s.final = true;

  IF v_submission IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_message', 'Submission not found or not final');
  END IF;

  -- BUG 1 FIX: Correct path is repeater->quotedDetails (not quoted_details)
  v_quoted_mappings := v_submission.field_mappings->'repeater'->'quotedDetails';

  -- Get quoted_details from payload (snake_case key)
  v_quoted_details := v_submission.payload_json->'quoted_details';

  IF v_quoted_details IS NULL OR jsonb_array_length(v_quoted_details) = 0 THEN
    RETURN jsonb_build_object('success', true, 'records_created', 0, 'message', 'No quoted details found');
  END IF;

  -- Get mapped field IDs for metrics (BUG 2: name/lead_source are direct keys, not mapped)
  v_items_field := v_quoted_mappings->>'items_quoted';
  v_policies_field := v_quoted_mappings->>'policies_quoted';
  v_premium_field := v_quoted_mappings->>'premium_potential_cents';

  -- Delete existing records
  DELETE FROM quoted_household_details WHERE submission_id = p_submission_id;

  -- Insert records
  FOR v_detail IN SELECT value FROM jsonb_array_elements(v_quoted_details)
  LOOP
    INSERT INTO quoted_household_details (
      submission_id, agency_id, team_member_id, role, work_date,
      household_name, lead_source_label,
      items_quoted, policies_quoted, premium_potential_cents, extras
    ) VALUES (
      p_submission_id,
      v_submission.agency_id,
      v_submission.team_member_id,
      v_submission.role,
      v_submission.work_date,
      v_detail->>'prospect_name',           -- BUG 2 FIX: Direct key
      v_detail->>'lead_source_label',       -- BUG 2 FIX: Direct key
      COALESCE((v_detail->>v_items_field)::int, 0),
      COALESCE((v_detail->>v_policies_field)::int, 0),
      COALESCE((v_detail->>v_premium_field)::numeric * 100, 0)::bigint,  -- BUG 3 FIX: * 100
      jsonb_build_object('raw_json', v_detail)
    );
    v_records_created := v_records_created + 1;
  END LOOP;

  -- Audit log
  INSERT INTO field_mapping_audit (
    submission_id, form_template_id, agency_id, mappings_used,
    items_extracted, policies_extracted, premium_extracted
  ) VALUES (
    p_submission_id, v_submission.form_template_id, v_submission.agency_id,
    v_quoted_mappings IS NOT NULL, v_records_created, v_records_created, 0
  );

  RETURN jsonb_build_object('success', true, 'records_created', v_records_created);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error_message', SQLERRM, 'sql_state', SQLSTATE);
END;
$$;