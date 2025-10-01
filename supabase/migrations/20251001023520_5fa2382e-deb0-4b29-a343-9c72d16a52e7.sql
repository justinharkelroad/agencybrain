-- Create a temporary function to run the backfill
CREATE OR REPLACE FUNCTION run_backfill_migration()
RETURNS TABLE(
  submissions_processed int,
  records_created int,
  errors int,
  details jsonb
) AS $$
DECLARE
  v_submission_id uuid;
  v_result jsonb;
  v_total_processed int := 0;
  v_total_records int := 0;
  v_errors int := 0;
  v_details jsonb := '[]'::jsonb;
BEGIN
  -- Process each submission that needs backfilling
  FOR v_submission_id IN 
    SELECT submission_id 
    FROM vw_flattening_health 
    WHERE status IN ('flattening_failed', 'partial_flattening')
    ORDER BY submission_date DESC
  LOOP
    BEGIN
      -- Call the flatten function
      SELECT flatten_quoted_household_details_enhanced(v_submission_id) INTO v_result;
      
      v_total_processed := v_total_processed + 1;
      
      IF (v_result->>'success')::boolean THEN
        v_total_records := v_total_records + COALESCE((v_result->>'records_created')::int, 0);
        v_details := v_details || jsonb_build_array(
          jsonb_build_object(
            'submission_id', v_submission_id,
            'status', 'success',
            'records_created', v_result->>'records_created'
          )
        );
      ELSE
        v_errors := v_errors + 1;
        v_details := v_details || jsonb_build_array(
          jsonb_build_object(
            'submission_id', v_submission_id,
            'status', 'error',
            'error_message', v_result->>'error_message'
          )
        );
      END IF;
      
    EXCEPTION
      WHEN OTHERS THEN
        v_errors := v_errors + 1;
        v_details := v_details || jsonb_build_array(
          jsonb_build_object(
            'submission_id', v_submission_id,
            'status', 'exception',
            'error_message', SQLERRM
          )
        );
    END;
  END LOOP;
  
  RETURN QUERY SELECT v_total_processed, v_total_records, v_errors, v_details;
END;
$$ LANGUAGE plpgsql;

-- Run the backfill
SELECT * FROM run_backfill_migration();

-- Verify results
SELECT COUNT(*) as total_records FROM quoted_household_details;

-- Show sample with timestamps
SELECT 
  household_name,
  work_date,
  DATE(created_at) as created_date,
  CASE 
    WHEN DATE(created_at) = '2025-10-01' THEN '❌ Wrong'
    ELSE '✅ Correct'
  END as timestamp_status
FROM quoted_household_details
ORDER BY created_at DESC
LIMIT 5;

-- Drop the temporary function
DROP FUNCTION run_backfill_migration();