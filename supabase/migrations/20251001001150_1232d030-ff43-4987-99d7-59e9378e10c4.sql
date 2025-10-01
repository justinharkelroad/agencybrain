-- Backfill missing quoted_household_details for recent submissions
-- Target: All submissions from last 30 days with quoted_details that haven't been flattened
-- This will catch James Toney (19ebc10a-6906-41c2-b786-82a300fbc890) and any others

DO $$
DECLARE
  sub_record RECORD;
  processed_count INTEGER := 0;
  error_count INTEGER := 0;
  skipped_count INTEGER := 0;
  total_to_process INTEGER := 0;
BEGIN
  -- First, count how many submissions need processing
  SELECT COUNT(*) INTO total_to_process
  FROM submissions s
  WHERE s.submitted_at >= (NOW() - INTERVAL '30 days')
    AND s.final = true
    AND s.payload_json ? 'quoted_details'
    AND NOT EXISTS (
      SELECT 1 FROM quoted_household_details qhd 
      WHERE qhd.submission_id = s.id
    );
  
  RAISE NOTICE '==========================================';
  RAISE NOTICE 'BACKFILL MISSING QUOTED DETAILS - STARTING';
  RAISE NOTICE 'Total submissions to process: %', total_to_process;
  RAISE NOTICE '==========================================';
  
  -- Process each missing submission
  FOR sub_record IN 
    SELECT 
      s.id,
      s.submitted_at,
      s.team_member_id,
      tm.name as team_member_name,
      jsonb_array_length(s.payload_json->'quoted_details') as prospect_count
    FROM submissions s
    LEFT JOIN team_members tm ON tm.id = s.team_member_id
    WHERE s.submitted_at >= (NOW() - INTERVAL '30 days')
      AND s.final = true
      AND s.payload_json ? 'quoted_details'
      AND NOT EXISTS (
        SELECT 1 FROM quoted_household_details qhd 
        WHERE qhd.submission_id = s.id
      )
    ORDER BY s.submitted_at DESC
  LOOP
    BEGIN
      -- Log what we're processing
      RAISE NOTICE 'Processing submission % by % (% prospects) submitted %', 
        sub_record.id, 
        COALESCE(sub_record.team_member_name, 'Unknown'),
        sub_record.prospect_count,
        sub_record.submitted_at;
      
      -- Call the corrected flattening function
      PERFORM public.flatten_quoted_household_details_enhanced(sub_record.id);
      
      processed_count := processed_count + 1;
      
      -- Verify it worked
      IF EXISTS (SELECT 1 FROM quoted_household_details WHERE submission_id = sub_record.id) THEN
        RAISE NOTICE '✅ SUCCESS: Created % prospect records for submission %', 
          (SELECT COUNT(*) FROM quoted_household_details WHERE submission_id = sub_record.id),
          sub_record.id;
      ELSE
        RAISE WARNING '⚠️ WARNING: No records created for submission % (might have 0 prospects)', sub_record.id;
        skipped_count := skipped_count + 1;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      error_count := error_count + 1;
      RAISE WARNING '❌ FAILED to process submission %: % - %', sub_record.id, SQLERRM, SQLSTATE;
    END;
  END LOOP;
  
  RAISE NOTICE '==========================================';
  RAISE NOTICE 'BACKFILL COMPLETE';
  RAISE NOTICE 'Total to process: %', total_to_process;
  RAISE NOTICE 'Successfully processed: %', processed_count;
  RAISE NOTICE 'Skipped (0 prospects): %', skipped_count;
  RAISE NOTICE 'Errors: %', error_count;
  RAISE NOTICE '==========================================';
  
  -- Final verification
  RAISE NOTICE 'Verifying James Toney submission (19ebc10a-6906-41c2-b786-82a300fbc890)...';
  IF EXISTS (
    SELECT 1 FROM quoted_household_details 
    WHERE submission_id = '19ebc10a-6906-41c2-b786-82a300fbc890'
  ) THEN
    RAISE NOTICE '✅ James Toney submission successfully flattened and visible in Explorer';
  ELSE
    RAISE WARNING '❌ James Toney submission NOT found in quoted_household_details';
  END IF;
  
END $$;