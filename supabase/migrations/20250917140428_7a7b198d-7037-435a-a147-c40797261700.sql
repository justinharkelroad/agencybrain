-- Step 3: One-time backfill for recent finals (last 60 days to be safe)
DO $$
DECLARE 
  r RECORD;
  processed_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting backfill of quoted_household_details for recent submissions...';
  
  FOR r IN
    SELECT id, submission_date 
    FROM public.submissions
    WHERE final = true 
      AND submission_date >= (CURRENT_DATE - INTERVAL '60 days')
    ORDER BY submission_date DESC
  LOOP
    PERFORM public.flatten_quoted_household_details(r.id);
    processed_count := processed_count + 1;
    
    -- Log progress every 50 records
    IF processed_count % 50 = 0 THEN
      RAISE NOTICE 'Processed % submissions...', processed_count;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Backfill complete. Processed % final submissions.', processed_count;
END$$;

-- Step 4: Add performance indexes
CREATE INDEX IF NOT EXISTS idx_qhd_created_at ON public.quoted_household_details(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qhd_submission_id ON public.quoted_household_details(submission_id);
CREATE INDEX IF NOT EXISTS idx_qhd_household_name ON public.quoted_household_details(household_name);
CREATE INDEX IF NOT EXISTS idx_qhd_items_quoted ON public.quoted_household_details(items_quoted);
CREATE INDEX IF NOT EXISTS idx_qhd_policies_quoted ON public.quoted_household_details(policies_quoted);