-- Execute manual backfill for quoted household details
-- Process recent submissions with the enhanced flattener

DO $$
DECLARE
  sub_record RECORD;
  processed_count INTEGER := 0;
  error_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting backfill process...';
  
  -- Process submissions from the last 30 days that have quotedDetails
  FOR sub_record IN 
    SELECT s.id, s.payload_json, s.submitted_at
    FROM submissions s
    JOIN form_templates ft ON ft.id = s.form_template_id
    WHERE s.submitted_at >= (NOW() - INTERVAL '30 days')
      AND s.final = true
      AND s.payload_json ? 'quotedDetails'
    ORDER BY s.submitted_at DESC
    LIMIT 100  -- Process up to 100 submissions
  LOOP
    BEGIN
      -- Call the enhanced flattener function with the submission ID
      PERFORM public.flatten_quoted_household_details_enhanced(sub_record.id);
      processed_count := processed_count + 1;
      
      IF processed_count % 10 = 0 THEN
        RAISE NOTICE 'Processed % submissions...', processed_count;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      error_count := error_count + 1;
      RAISE WARNING 'Failed to process submission %: %', sub_record.id, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE 'Backfill complete. Processed: %, Errors: %', processed_count, error_count;
END $$;