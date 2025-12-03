-- Fix flatten_quoted_household_details_enhanced INSERT to match actual table schema
-- The table doesn't have: form_template_id, detailed_notes, custom_field_values, raw_detail_json
-- The table does have: role, lead_source_label, policy_type, extras

CREATE OR REPLACE FUNCTION public.flatten_quoted_household_details_enhanced(p_submission_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_submission record;
  v_quoted_details jsonb;
  v_current_detail jsonb;
  v_agency_id uuid;
  v_team_member_id uuid;
  v_work_date date;
  v_role text;
  v_prospect_name text;
  v_zip_code text;
  v_lead_source_id uuid;
  v_lead_source_label text;
  v_items_quoted integer;
  v_policies_quoted integer;
  v_premium_cents integer;
  v_detailed_notes text;
  v_custom_field_values jsonb;
  v_records_created integer := 0;
  v_errors text[] := ARRAY[]::text[];
BEGIN
  -- Get submission data
  SELECT 
    s.id,
    s.payload_json,
    s.work_date,
    s.submission_date,
    ft.agency_id,
    s.team_member_id,
    tm.role::text as member_role
  INTO v_submission
  FROM submissions s
  JOIN form_templates ft ON ft.id = s.form_template_id
  LEFT JOIN team_members tm ON tm.id = s.team_member_id
  WHERE s.id = p_submission_id;

  IF v_submission IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_message', 'Submission not found',
      'records_created', 0
    );
  END IF;

  v_agency_id := v_submission.agency_id;
  v_team_member_id := v_submission.team_member_id;
  v_work_date := COALESCE(v_submission.work_date, v_submission.submission_date);
  v_role := COALESCE(v_submission.member_role, 'Sales');

  -- Extract quoted_details array from payload
  v_quoted_details := v_submission.payload_json->'quoted_details';

  IF v_quoted_details IS NULL OR jsonb_array_length(v_quoted_details) = 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'error_message', 'No quoted_details found in payload',
      'records_created', 0
    );
  END IF;

  -- Delete existing records for this submission to allow re-processing
  DELETE FROM quoted_household_details WHERE submission_id = p_submission_id;

  -- Process each quoted detail - FIXED: SELECT value FROM instead of SELECT * FROM
  FOR v_current_detail IN SELECT value FROM jsonb_array_elements(v_quoted_details)
  LOOP
    BEGIN
      -- Extract fields from the current detail
      v_prospect_name := COALESCE(
        v_current_detail->>'prospect_name',
        v_current_detail->>'prospectName',
        v_current_detail->>'name',
        'Unknown'
      );
      
      v_zip_code := COALESCE(
        v_current_detail->>'zip_code',
        v_current_detail->>'zipCode',
        v_current_detail->>'zip'
      );
      
      v_lead_source_label := COALESCE(
        v_current_detail->>'lead_source',
        v_current_detail->>'leadSource'
      );
      
      -- Try to resolve lead_source_id from label
      IF v_lead_source_label IS NOT NULL THEN
        SELECT id INTO v_lead_source_id
        FROM lead_sources
        WHERE agency_id = v_agency_id 
          AND name ILIKE v_lead_source_label
        LIMIT 1;
      ELSE
        v_lead_source_id := NULL;
      END IF;
      
      v_items_quoted := COALESCE(
        (v_current_detail->>'items_quoted')::integer,
        (v_current_detail->>'itemsQuoted')::integer,
        (v_current_detail->>'items')::integer,
        0
      );
      
      v_policies_quoted := COALESCE(
        (v_current_detail->>'policies_quoted')::integer,
        (v_current_detail->>'policiesQuoted')::integer,
        (v_current_detail->>'policies')::integer,
        0
      );
      
      v_premium_cents := COALESCE(
        (v_current_detail->>'premium_potential_cents')::integer,
        (v_current_detail->>'premiumPotentialCents')::integer,
        ((v_current_detail->>'premium')::numeric * 100)::integer,
        ((v_current_detail->>'premiumPotential')::numeric * 100)::integer,
        0
      );
      
      v_detailed_notes := COALESCE(
        v_current_detail->>'detailed_notes',
        v_current_detail->>'detailedNotes',
        v_current_detail->>'notes'
      );
      
      -- Extract custom fields if present
      v_custom_field_values := COALESCE(
        v_current_detail->'custom_fields',
        v_current_detail->'customFields',
        '{}'::jsonb
      );

      -- Insert into quoted_household_details with CORRECT columns
      INSERT INTO quoted_household_details (
        submission_id,
        agency_id,
        team_member_id,
        role,
        work_date,
        household_name,
        zip_code,
        lead_source_id,
        lead_source_label,
        items_quoted,
        policies_quoted,
        premium_potential_cents,
        extras
      ) VALUES (
        p_submission_id,
        v_agency_id,
        v_team_member_id,
        v_role::app_member_role,
        v_work_date,
        v_prospect_name,
        v_zip_code,
        v_lead_source_id,
        v_lead_source_label,
        v_items_quoted,
        v_policies_quoted,
        v_premium_cents,
        jsonb_build_object(
          'detailed_notes', v_detailed_notes,
          'custom_fields', v_custom_field_values,
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

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error_message', SQLERRM,
    'sql_state', SQLSTATE,
    'records_created', v_records_created
  );
END;
$function$;