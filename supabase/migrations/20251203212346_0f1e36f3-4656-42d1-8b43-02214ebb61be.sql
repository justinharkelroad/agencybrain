-- Update flatten_quoted_household_details_enhanced to auto-capitalize prospect names
CREATE OR REPLACE FUNCTION public.flatten_quoted_household_details_enhanced(p_submission_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_submission_payload jsonb;
  v_quoted_details jsonb;
  v_detail jsonb;
  v_agency_id uuid;
  v_team_member_id uuid;
  v_work_date date;
  v_form_template_id uuid;
  v_field_mappings jsonb;
  v_records_created int := 0;
  v_prospect_name text;
  v_lead_source_id uuid;
  v_lead_source_label text;
  v_items_quoted int;
  v_policies_quoted int;
  v_premium_potential numeric;
  v_zip_code text;
  v_extras jsonb;
BEGIN
  -- Get submission data with agency_id from form_templates join
  SELECT 
    s.payload_json,
    s.team_member_id,
    COALESCE(s.work_date, s.submission_date),
    s.form_template_id,
    ft.field_mappings,
    ft.agency_id
  INTO 
    v_submission_payload,
    v_team_member_id,
    v_work_date,
    v_form_template_id,
    v_field_mappings,
    v_agency_id
  FROM submissions s
  JOIN form_templates ft ON ft.id = s.form_template_id
  WHERE s.id = p_submission_id;
  
  IF v_submission_payload IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_message', 'Submission not found',
      'sql_state', 'P0002'
    );
  END IF;
  
  -- Extract quoted_details array from payload (use snake_case key)
  v_quoted_details := v_submission_payload->'quoted_details';
  
  -- If no quoted_details, check quotedDetails (camelCase fallback)
  IF v_quoted_details IS NULL THEN
    v_quoted_details := v_submission_payload->'quotedDetails';
  END IF;
  
  IF v_quoted_details IS NULL OR jsonb_typeof(v_quoted_details) != 'array' THEN
    RETURN jsonb_build_object(
      'success', true,
      'records_created', 0,
      'message', 'No quoted_details array found in submission'
    );
  END IF;
  
  -- Delete existing records for this submission to allow re-processing
  DELETE FROM quoted_household_details WHERE submission_id = p_submission_id;
  
  -- Process each household detail
  FOR v_detail IN SELECT value FROM jsonb_array_elements(v_quoted_details)
  LOOP
    -- Extract prospect name with field mapping support - USE INITCAP FOR AUTO-CAPITALIZE
    v_prospect_name := initcap(COALESCE(
      v_detail->>(COALESCE(v_field_mappings->'quoted_details'->>'household_name', 'prospect_name')),
      v_detail->>'prospect_name',
      v_detail->>'household_name',
      'Unknown'
    ));
    
    -- Extract lead source - try to get both ID and label
    v_lead_source_label := COALESCE(
      v_detail->>(COALESCE(v_field_mappings->'quoted_details'->>'lead_source', 'lead_source_label')),
      v_detail->>'lead_source_label',
      v_detail->>'lead_source'
    );
    
    -- Try to resolve lead_source_id from lead_sources table if we have a label
    IF v_lead_source_label IS NOT NULL THEN
      SELECT id INTO v_lead_source_id
      FROM lead_sources
      WHERE agency_id = v_agency_id AND name = v_lead_source_label
      LIMIT 1;
    ELSE
      v_lead_source_id := NULL;
    END IF;
    
    -- Extract numeric fields with field mapping support
    v_items_quoted := COALESCE(
      (v_detail->>(COALESCE(v_field_mappings->'quoted_details'->>'items_quoted', 'items_quoted')))::int,
      (v_detail->>'items_quoted')::int,
      0
    );
    
    v_policies_quoted := COALESCE(
      (v_detail->>(COALESCE(v_field_mappings->'quoted_details'->>'policies_quoted', 'policies_quoted')))::int,
      (v_detail->>'policies_quoted')::int,
      0
    );
    
    -- Premium: handle decimal values, multiply by 100 for cents, round to integer
    v_premium_potential := COALESCE(
      (v_detail->>(COALESCE(v_field_mappings->'quoted_details'->>'premium_potential', 'premium_potential')))::numeric,
      (v_detail->>'premium_potential')::numeric,
      (v_detail->>'premium_potential_cents')::numeric / 100.0,
      0
    );
    
    -- Extract zip code
    v_zip_code := COALESCE(
      v_detail->>'zip_code',
      v_detail->>'zip'
    );
    
    -- Build extras JSON with remaining fields
    v_extras := jsonb_build_object(
      'detailed_notes', v_detail->>'detailed_notes',
      'notes', v_detail->>'notes',
      'custom_fields', v_detail->'custom_fields'
    );
    
    -- Insert the flattened record
    INSERT INTO quoted_household_details (
      submission_id,
      agency_id,
      team_member_id,
      work_date,
      household_name,
      lead_source_id,
      lead_source_label,
      items_quoted,
      policies_quoted,
      premium_potential_cents,
      zip_code,
      extras
    ) VALUES (
      p_submission_id,
      v_agency_id,
      v_team_member_id,
      v_work_date,
      v_prospect_name,
      v_lead_source_id,
      v_lead_source_label,
      v_items_quoted,
      v_policies_quoted,
      ROUND(v_premium_potential * 100)::int,
      v_zip_code,
      v_extras
    );
    
    v_records_created := v_records_created + 1;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'records_created', v_records_created,
    'submission_id', p_submission_id
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error_message', SQLERRM,
    'sql_state', SQLSTATE
  );
END;
$$;