-- Run backfill for all submissions with flattening issues
DO $$
DECLARE
  v_submission_id uuid;
  v_result jsonb;
  v_total_processed int := 0;
  v_total_records int := 0;
  v_errors int := 0;
BEGIN
  -- Process each submission that needs backfilling
  FOR v_submission_id IN 
    SELECT submission_id 
    FROM vw_flattening_health 
    WHERE status IN ('flattening_failed', 'partial_flattening')
    ORDER BY submission_date DESC
  LOOP
    BEGIN
      -- Call the flatten function for this submission
      SELECT flatten_quoted_household_details_enhanced(v_submission_id) INTO v_result;
      
      v_total_processed := v_total_processed + 1;
      
      IF (v_result->>'success')::boolean THEN
        v_total_records := v_total_records + (v_result->>'records_created')::int;
        RAISE NOTICE 'Processed submission %: % records created', v_submission_id, v_result->>'records_created';
      ELSE
        v_errors := v_errors + 1;
        RAISE WARNING 'Failed to process submission %: %', v_submission_id, v_result->>'error_message';
      END IF;
      
    EXCEPTION
      WHEN OTHERS THEN
        v_errors := v_errors + 1;
        RAISE WARNING 'Error processing submission %: %', v_submission_id, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE '=== BACKFILL COMPLETE ===';
  RAISE NOTICE 'Submissions processed: %', v_total_processed;
  RAISE NOTICE 'Records created: %', v_total_records;
  RAISE NOTICE 'Errors: %', v_errors;
END $$;

-- Verify the results
SELECT 
  'Flattening Status' as metric,
  status,
  COUNT(*) as count
FROM vw_flattening_health
GROUP BY status
ORDER BY status;

-- Show sample of recreated records with correct timestamps
SELECT 
  household_name,
  work_date,
  created_at,
  CASE 
    WHEN created_at >= '2025-10-01' THEN '❌ Wrong (today)'
    ELSE '✅ Correct (original)'
  END as timestamp_status
FROM quoted_household_details
ORDER BY created_at DESC
LIMIT 10;