-- Backfill recent submissions to populate quoted_household_details with proper data
-- This processes the last 30 days of submissions through the enhanced flattener

DO $$
DECLARE
  sub_record RECORD;
  processed_count INTEGER := 0;
BEGIN
  -- Process submissions from the last 30 days
  FOR sub_record IN 
    SELECT s.* 
    FROM submissions s
    JOIN form_templates ft ON ft.id = s.form_template_id
    WHERE s.submitted_at >= (NOW() - INTERVAL '30 days')
      AND s.final = true
      AND s.payload_json ? 'quotedDetails'
    ORDER BY s.submitted_at DESC
    LIMIT 1000  -- Process up to 1000 submissions to avoid timeout
  LOOP
    -- Trigger the enhanced flattener for each submission
    BEGIN
      PERFORM public.flatten_quoted_household_details_enhanced()
      FROM (SELECT 
        sub_record.id,
        sub_record.form_template_id,
        sub_record.payload_json,
        sub_record.final
      ) AS fake_trigger_data;
      
      processed_count := processed_count + 1;
    EXCEPTION WHEN OTHERS THEN
      -- Log errors but continue processing
      RAISE WARNING 'Failed to process submission %: %', sub_record.id, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE 'Processed % submissions for backfill', processed_count;
END $$;