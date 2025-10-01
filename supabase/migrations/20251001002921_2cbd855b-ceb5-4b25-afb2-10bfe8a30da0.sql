-- Update flatten_quoted_household_details_enhanced to extract custom fields with readable labels
-- This enhances the function to map custom field keys to human-readable labels from schema_json

CREATE OR REPLACE FUNCTION public.flatten_quoted_household_details_enhanced(p_submission_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  submission_rec record;
  form_mappings jsonb;
  form_custom_fields jsonb;
  quoted_detail jsonb;
  mapping_notes_key text;
  mapping_items_key text;
  mapping_policies_key text;
  mapping_premium_key text;
  custom_fields_extracted jsonb;
  field_item jsonb;
  field_key text;
  field_value text;
BEGIN
  -- Get submission and form template mappings + schema
  SELECT 
    s.*, 
    ft.field_mappings,
    ft.schema_json,
    ft.agency_id,
    tm.id as team_member_id,
    tm.role
  INTO submission_rec
  FROM submissions s
  JOIN form_templates ft ON ft.id = s.form_template_id
  LEFT JOIN team_members tm ON tm.id = s.team_member_id
  WHERE s.id = p_submission_id;

  IF NOT FOUND THEN
    RAISE NOTICE 'Submission % not found', p_submission_id;
    RETURN;
  END IF;

  -- Get field mappings
  form_mappings := COALESCE(submission_rec.field_mappings->'quoted_details', '{}'::jsonb);
  mapping_notes_key := form_mappings->>'notes';
  mapping_items_key := form_mappings->>'items_quoted';
  mapping_policies_key := form_mappings->>'policies_quoted';
  mapping_premium_key := form_mappings->>'premium_potential_cents';
  
  -- Get custom fields definitions from schema
  form_custom_fields := COALESCE(submission_rec.schema_json->'customFields', '[]'::jsonb);

  -- Delete existing records for this submission
  DELETE FROM quoted_household_details WHERE submission_id = p_submission_id;

  -- Process each quoted detail
  FOR quoted_detail IN 
    SELECT jsonb_array_elements(COALESCE(submission_rec.payload_json->'quoted_details', '[]'::jsonb))
  LOOP
    -- Build custom fields object with readable labels
    custom_fields_extracted := '{}'::jsonb;
    
    -- Loop through each custom field definition in schema
    FOR field_item IN 
      SELECT * FROM jsonb_array_elements(form_custom_fields)
    LOOP
      field_key := field_item->>'key';
      
      -- Check if this custom field exists in the quoted detail
      IF quoted_detail ? field_key THEN
        field_value := quoted_detail->>field_key;
        
        -- Build structured custom field entry
        custom_fields_extracted := custom_fields_extracted || jsonb_build_object(
          field_item->>'label',  -- Use label as key for readability
          jsonb_build_object(
            'label', field_item->>'label',
            'value', field_value,
            'field_key', field_key,
            'field_type', field_item->>'type'
          )
        );
      END IF;
    END LOOP;
    
    -- Extract values using mappings or fallbacks
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
      extras,
      created_at
    ) VALUES (
      p_submission_id,
      submission_rec.agency_id,
      submission_rec.team_member_id,
      submission_rec.role,
      COALESCE(submission_rec.work_date, submission_rec.submission_date),
      quoted_detail->>'prospect_name',
      quoted_detail->>'zip_code',
      CASE 
        WHEN quoted_detail->>'lead_source' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN (quoted_detail->>'lead_source')::uuid
        ELSE NULL
      END,
      COALESCE(
        (SELECT name FROM lead_sources WHERE id = (quoted_detail->>'lead_source')::uuid),
        quoted_detail->>'lead_source',
        'Undefined'
      ),
      -- Map items_quoted
      CASE 
        WHEN mapping_items_key IS NOT NULL THEN 
          COALESCE((quoted_detail->>mapping_items_key)::integer, 0)
        ELSE 
          COALESCE((quoted_detail->>'items_quoted')::integer, 0)
      END,
      -- Map policies_quoted  
      CASE 
        WHEN mapping_policies_key IS NOT NULL THEN
          CASE 
            WHEN LOWER(quoted_detail->>mapping_policies_key) IN ('yes', '1', 'true') THEN 1
            WHEN LOWER(quoted_detail->>mapping_policies_key) IN ('no', '0', 'false') THEN 0
            ELSE COALESCE((quoted_detail->>mapping_policies_key)::integer, 0)
          END
        ELSE 
          COALESCE((quoted_detail->>'policies_quoted')::integer, 0)
      END,
      -- Map premium_potential_cents
      CASE 
        WHEN mapping_premium_key IS NOT NULL THEN
          CASE 
            WHEN quoted_detail->>mapping_premium_key ~ '^\$?[0-9]+(\.[0-9]{2})?$' THEN
              (REPLACE(REPLACE(quoted_detail->>mapping_premium_key, '$', ''), ',', '')::numeric * 100)::bigint
            ELSE 
              COALESCE((quoted_detail->>mapping_premium_key)::bigint, 0)
          END
        ELSE 
          COALESCE((quoted_detail->>'premium_potential_cents')::bigint, 0)
      END,
      -- Store notes, custom fields, and other extras
      jsonb_build_object(
        'notes', COALESCE(
          CASE WHEN mapping_notes_key IS NOT NULL THEN quoted_detail->>mapping_notes_key END,
          quoted_detail->>'detailed_notes'
        ),
        'custom_fields', custom_fields_extracted,
        'original_data', quoted_detail
      ),
      now()
    );
  END LOOP;

  -- Log the mapping usage
  INSERT INTO field_mapping_audit (
    submission_id,
    form_template_id,
    agency_id,
    mappings_used,
    created_at
  ) VALUES (
    p_submission_id,
    submission_rec.form_template_id,
    submission_rec.agency_id,
    form_mappings != '{}'::jsonb,
    now()
  );

END;
$function$;