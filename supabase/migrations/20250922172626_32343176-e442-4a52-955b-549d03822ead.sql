-- Fix the enhanced flattener to use correct field name and re-run backfill
-- The issue was looking for 'quoted_details' when data is stored as 'quotedDetails'

-- Update the function to handle the correct field name
CREATE OR REPLACE FUNCTION public.flatten_quoted_household_details_enhanced(p_submission_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  submission_rec record;
  form_mappings jsonb;
  quoted_detail jsonb;
  mapping_notes_key text;
  mapping_items_key text;
  mapping_policies_key text;
  mapping_premium_key text;
BEGIN
  -- Get submission and form template mappings
  SELECT 
    s.*, 
    ft.field_mappings,
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

  -- Delete existing records for this submission
  DELETE FROM quoted_household_details WHERE submission_id = p_submission_id;

  -- Process each quoted detail - FIXED: use 'quotedDetails' not 'quoted_details'
  FOR quoted_detail IN 
    SELECT jsonb_array_elements(COALESCE(submission_rec.payload_json->'quotedDetails', '[]'::jsonb))
  LOOP
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
      -- Store notes and other extras
      jsonb_build_object(
        'notes', COALESCE(
          CASE WHEN mapping_notes_key IS NOT NULL THEN quoted_detail->>mapping_notes_key END,
          quoted_detail->>'detailed_notes'
        ),
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

-- Now run the corrected backfill with proper field name
DO $$
DECLARE
  sub_record RECORD;
  processed_count INTEGER := 0;
  error_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting corrected backfill process...';
  
  -- Process submissions from the last 30 days that have quotedDetails (camelCase)
  FOR sub_record IN 
    SELECT s.id, s.payload_json, s.submitted_at
    FROM submissions s
    JOIN form_templates ft ON ft.id = s.form_template_id
    WHERE s.submitted_at >= (NOW() - INTERVAL '30 days')
      AND s.final = true
      AND s.payload_json ? 'quotedDetails'  -- FIXED: use correct field name
    ORDER BY s.submitted_at DESC
    LIMIT 50
  LOOP
    BEGIN
      -- Call the enhanced flattener function with the submission ID
      PERFORM public.flatten_quoted_household_details_enhanced(sub_record.id);
      processed_count := processed_count + 1;
      
      IF processed_count % 5 = 0 THEN
        RAISE NOTICE 'Processed % submissions...', processed_count;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      error_count := error_count + 1;
      RAISE WARNING 'Failed to process submission %: %', sub_record.id, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE 'Corrected backfill complete. Processed: %, Errors: %', processed_count, error_count;
END $$;