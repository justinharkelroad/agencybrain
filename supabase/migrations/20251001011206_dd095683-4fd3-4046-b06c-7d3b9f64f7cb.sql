-- Drop the existing function first
DROP FUNCTION IF EXISTS public.flatten_quoted_household_details_enhanced(uuid);

-- Create enhanced flatten function with comprehensive logging and error handling
CREATE OR REPLACE FUNCTION public.flatten_quoted_household_details_enhanced(p_submission_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_submission record;
  v_form_template record;
  v_schema jsonb;
  v_quoted_details jsonb;
  v_quoted_detail jsonb;
  v_custom_fields_map jsonb := '{}'::jsonb;
  v_field record;
  v_field_key text;
  v_field_label text;
  v_field_type text;
  v_field_value text;
  v_records_created integer := 0;
  v_error_message text;
  v_payload_keys text[];
BEGIN
  -- Step 1: Log start and fetch submission
  RAISE NOTICE 'flatten_quoted_household_details_enhanced START - submission_id: %', p_submission_id;
  
  BEGIN
    SELECT s.*, ft.schema_json, ft.agency_id, ft.role
    INTO v_submission
    FROM submissions s
    JOIN form_templates ft ON ft.id = s.form_template_id
    WHERE s.id = p_submission_id;

    IF NOT FOUND THEN
      v_error_message := 'Submission not found: ' || p_submission_id::text;
      RAISE NOTICE 'ERROR: %', v_error_message;
      RETURN jsonb_build_object(
        'success', false,
        'records_created', 0,
        'error_message', v_error_message
      );
    END IF;

    -- Step 2: Log payload structure
    v_payload_keys := ARRAY(SELECT jsonb_object_keys(v_submission.payload_json));
    RAISE NOTICE 'Payload keys found: %', array_to_string(v_payload_keys, ', ');
    
    v_quoted_details := v_submission.payload_json->'quoted_details';
    
    -- Step 3: Validation - check if quoted_details exists
    IF v_quoted_details IS NULL THEN
      RAISE WARNING 'No quoted_details found in payload_json for submission %', p_submission_id;
      RETURN jsonb_build_object(
        'success', true,
        'records_created', 0,
        'error_message', 'No quoted_details in payload - skipped'
      );
    END IF;

    IF jsonb_typeof(v_quoted_details) != 'array' THEN
      v_error_message := 'quoted_details is not an array, type: ' || jsonb_typeof(v_quoted_details);
      RAISE WARNING '%', v_error_message;
      RETURN jsonb_build_object(
        'success', false,
        'records_created', 0,
        'error_message', v_error_message
      );
    END IF;

    RAISE NOTICE 'Found % quoted_details entries to process', jsonb_array_length(v_quoted_details);

    -- Step 4: Build schema lookups for custom fields
    v_schema := v_submission.schema_json;
    
    -- Extract custom fields from root customFields
    IF v_schema->'customFields' IS NOT NULL AND jsonb_typeof(v_schema->'customFields') = 'array' THEN
      FOR v_field IN SELECT * FROM jsonb_array_elements(v_schema->'customFields')
      LOOP
        v_field_key := v_field.value->>'key';
        v_field_label := v_field.value->>'label';
        v_field_type := v_field.value->>'type';
        
        v_custom_fields_map := v_custom_fields_map || jsonb_build_object(
          v_field_key,
          jsonb_build_object(
            'label', v_field_label,
            'type', v_field_type
          )
        );
      END LOOP;
    END IF;

    -- Extract custom fields from repeaterSections.quotedDetails.fields
    IF v_schema->'repeaterSections'->'quotedDetails'->'fields' IS NOT NULL 
       AND jsonb_typeof(v_schema->'repeaterSections'->'quotedDetails'->'fields') = 'array' THEN
      FOR v_field IN SELECT * FROM jsonb_array_elements(v_schema->'repeaterSections'->'quotedDetails'->'fields')
      LOOP
        v_field_key := v_field.value->>'key';
        v_field_label := v_field.value->>'label';
        v_field_type := v_field.value->>'type';
        
        v_custom_fields_map := v_custom_fields_map || jsonb_build_object(
          v_field_key,
          jsonb_build_object(
            'label', v_field_label,
            'type', v_field_type
          )
        );
      END LOOP;
    END IF;

    RAISE NOTICE 'Built custom fields map with % fields', (SELECT COUNT(*) FROM jsonb_object_keys(v_custom_fields_map));

    -- Step 5: Delete existing records (idempotence)
    DELETE FROM quoted_household_details WHERE submission_id = p_submission_id;

    -- Step 6: Process each quoted detail
    FOR v_quoted_detail IN SELECT * FROM jsonb_array_elements(v_quoted_details)
    LOOP
      DECLARE
        v_prospect_name text;
        v_custom_field_values jsonb := '{}'::jsonb;
        v_lead_source_id uuid;
      BEGIN
        -- Extract prospect name
        v_prospect_name := COALESCE(
          v_quoted_detail.value->>'prospect_name',
          v_quoted_detail.value->>'household_name',
          v_quoted_detail.value->>'name'
        );

        -- Skip if no prospect name
        IF v_prospect_name IS NULL OR v_prospect_name = '' THEN
          RAISE NOTICE 'Skipping entry with no prospect_name';
          CONTINUE;
        END IF;

        -- Extract custom field values
        FOR v_field_key IN SELECT jsonb_object_keys(v_custom_fields_map)
        LOOP
          v_field_value := v_quoted_detail.value->>v_field_key;
          
          IF v_field_value IS NOT NULL AND v_field_value != '' THEN
            v_field_label := v_custom_fields_map->v_field_key->>'label';
            v_field_type := v_custom_fields_map->v_field_key->>'type';
            
            v_custom_field_values := v_custom_field_values || jsonb_build_object(
              v_field_label,
              jsonb_build_object(
                'field_key', v_field_key,
                'field_type', v_field_type,
                'label', v_field_label,
                'value', v_field_value
              )
            );
          END IF;
        END LOOP;

        -- Resolve lead source
        v_lead_source_id := NULL;
        IF v_quoted_detail.value->>'lead_source' IS NOT NULL THEN
          SELECT id INTO v_lead_source_id
          FROM lead_sources
          WHERE agency_id = v_submission.agency_id
            AND name = v_quoted_detail.value->>'lead_source'
          LIMIT 1;
        END IF;

        -- Insert record
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
          v_submission.agency_id,
          v_submission.team_member_id,
          v_submission.role,
          COALESCE(v_submission.work_date, v_submission.submission_date),
          v_prospect_name,
          v_quoted_detail.value->>'zip_code',
          v_lead_source_id,
          v_quoted_detail.value->>'lead_source',
          NULLIF((v_quoted_detail.value->>'items_quoted')::int, 0),
          NULLIF((v_quoted_detail.value->>'policies_quoted')::int, 0),
          NULLIF((v_quoted_detail.value->>'premium_potential_cents')::bigint, 0),
          jsonb_build_object(
            'original_data', v_quoted_detail.value,
            'custom_fields', v_custom_field_values,
            'detailed_notes', COALESCE(
              v_quoted_detail.value->>'detailed_notes',
              v_quoted_detail.value->>'notes'
            )
          )
        );

        v_records_created := v_records_created + 1;

      EXCEPTION
        WHEN OTHERS THEN
          v_error_message := SQLERRM;
          RAISE WARNING 'Error processing quoted detail for submission %: %', p_submission_id, v_error_message;
          -- Continue processing other records
      END;
    END LOOP;

    -- Step 7: Log success
    RAISE NOTICE 'Successfully created % quoted_household_details records for submission %', v_records_created, p_submission_id;

    RETURN jsonb_build_object(
      'success', true,
      'records_created', v_records_created,
      'error_message', NULL
    );

  EXCEPTION
    WHEN OTHERS THEN
      v_error_message := SQLERRM;
      RAISE NOTICE 'ERROR in flatten_quoted_household_details_enhanced: % - %', SQLSTATE, v_error_message;
      
      RETURN jsonb_build_object(
        'success', false,
        'records_created', v_records_created,
        'error_message', v_error_message,
        'sql_state', SQLSTATE
      );
  END;
END;
$function$;

-- Create a flattening health monitoring view
CREATE OR REPLACE VIEW public.vw_flattening_health AS
WITH recent_submissions AS (
  SELECT 
    s.id,
    s.form_template_id,
    s.team_member_id,
    s.submission_date,
    s.work_date,
    s.final,
    s.payload_json->'quoted_details' as quoted_details,
    CASE 
      WHEN s.payload_json->'quoted_details' IS NULL THEN false
      WHEN jsonb_typeof(s.payload_json->'quoted_details') != 'array' THEN false
      ELSE true
    END as has_valid_quoted_details,
    CASE 
      WHEN s.payload_json->'quoted_details' IS NOT NULL 
           AND jsonb_typeof(s.payload_json->'quoted_details') = 'array' 
      THEN jsonb_array_length(s.payload_json->'quoted_details')
      ELSE 0
    END as quoted_details_count
  FROM submissions s
  WHERE s.created_at >= now() - interval '30 days'
    AND s.final = true
),
flattened_counts AS (
  SELECT 
    qhd.submission_id,
    COUNT(*) as flattened_count
  FROM quoted_household_details qhd
  WHERE qhd.created_at >= now() - interval '30 days'
  GROUP BY qhd.submission_id
)
SELECT 
  rs.id as submission_id,
  rs.submission_date,
  rs.work_date,
  rs.has_valid_quoted_details,
  rs.quoted_details_count as expected_records,
  COALESCE(fc.flattened_count, 0) as actual_records,
  CASE 
    WHEN NOT rs.has_valid_quoted_details THEN 'no_quoted_details'
    WHEN rs.quoted_details_count = 0 THEN 'empty_array'
    WHEN COALESCE(fc.flattened_count, 0) = 0 THEN 'flattening_failed'
    WHEN COALESCE(fc.flattened_count, 0) < rs.quoted_details_count THEN 'partial_flattening'
    WHEN COALESCE(fc.flattened_count, 0) = rs.quoted_details_count THEN 'success'
    ELSE 'unknown'
  END as status
FROM recent_submissions rs
LEFT JOIN flattened_counts fc ON fc.submission_id = rs.id
ORDER BY rs.submission_date DESC;

-- Create monitoring summary view
CREATE OR REPLACE VIEW public.vw_flattening_summary AS
SELECT 
  COUNT(*) as total_submissions,
  COUNT(*) FILTER (WHERE has_valid_quoted_details) as submissions_with_quoted_details,
  COUNT(*) FILTER (WHERE status = 'success') as successful_flattenings,
  COUNT(*) FILTER (WHERE status = 'flattening_failed') as failed_flattenings,
  COUNT(*) FILTER (WHERE status = 'partial_flattening') as partial_flattenings,
  COUNT(*) FILTER (WHERE status = 'no_quoted_details') as no_quoted_details,
  SUM(expected_records) as total_expected_records,
  SUM(actual_records) as total_actual_records,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE status = 'success') / 
    NULLIF(COUNT(*) FILTER (WHERE has_valid_quoted_details), 0),
    2
  ) as success_rate_percent
FROM vw_flattening_health;

COMMENT ON VIEW vw_flattening_health IS 'Monitors flattening health for the last 30 days, showing which submissions failed to flatten';
COMMENT ON VIEW vw_flattening_summary IS 'Provides a summary of flattening success rates and counts for the last 30 days';