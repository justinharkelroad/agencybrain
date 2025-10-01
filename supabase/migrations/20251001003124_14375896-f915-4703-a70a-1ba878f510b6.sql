-- Re-flatten all recent submissions to apply custom field extraction with readable labels
-- Fixed SQL query with proper ORDER BY

DO $$
DECLARE
  sub_record RECORD;
  processed_count INTEGER := 0;
  error_count INTEGER := 0;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'RE-FLATTENING SUBMISSIONS WITH CUSTOM FIELD LABELS';
  RAISE NOTICE '========================================';
  
  FOR sub_record IN 
    SELECT DISTINCT qhd.submission_id, MAX(s.submitted_at) as latest_submission
    FROM quoted_household_details qhd
    JOIN submissions s ON s.id = qhd.submission_id
    WHERE s.submitted_at >= (NOW() - INTERVAL '30 days')
    GROUP BY qhd.submission_id
    ORDER BY MAX(s.submitted_at) DESC
  LOOP
    BEGIN
      PERFORM public.flatten_quoted_household_details_enhanced(sub_record.submission_id);
      processed_count := processed_count + 1;
      
      IF processed_count % 5 = 0 THEN
        RAISE NOTICE 'Processed % submissions...', processed_count;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      error_count := error_count + 1;
      RAISE WARNING 'Failed to process submission %: %', sub_record.submission_id, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'COMPLETE: Processed %, Errors: %', processed_count, error_count;
  RAISE NOTICE 'Custom fields now have readable labels in extras->custom_fields';
  RAISE NOTICE '========================================';
END $$;