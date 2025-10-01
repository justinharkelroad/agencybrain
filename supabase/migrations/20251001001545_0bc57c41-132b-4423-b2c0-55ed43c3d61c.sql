-- Backfill the 3 remaining missing submissions
-- These submissions have quoted_details but weren't caught by the first backfill

DO $$
DECLARE
  missing_ids uuid[] := ARRAY[
    '15f2c788-e1e7-4853-b452-f16dbdbafa35',
    '5d6064d3-473d-4ed6-af05-6b72d9031151',
    'bbccbaa0-74e1-484d-81be-3b8b78d24259'
  ];
  submission_id uuid;
  processed_count INTEGER := 0;
BEGIN
  RAISE NOTICE '==========================================';
  RAISE NOTICE 'PROCESSING REMAINING 3 SUBMISSIONS';
  RAISE NOTICE '==========================================';
  
  FOREACH submission_id IN ARRAY missing_ids
  LOOP
    BEGIN
      RAISE NOTICE 'Processing submission: %', submission_id;
      PERFORM public.flatten_quoted_household_details_enhanced(submission_id);
      processed_count := processed_count + 1;
      RAISE NOTICE '✅ Success: Submission % flattened', submission_id;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '❌ Failed to process %: %', submission_id, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE '==========================================';
  RAISE NOTICE 'COMPLETE: Processed % submissions', processed_count;
  RAISE NOTICE '==========================================';
END $$;