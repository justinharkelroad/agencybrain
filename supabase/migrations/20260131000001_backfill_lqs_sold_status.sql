-- Backfill: Find all sales that should have updated LQS household status to 'sold'
-- and update them now

DO $$
DECLARE
  v_agency RECORD;
  v_result RECORD;
  v_count int := 0;
BEGIN
  -- Process each agency
  FOR v_agency IN 
    SELECT DISTINCT agency_id FROM sales
  LOOP
    -- Run the backfill for this agency
    FOR v_result IN 
      SELECT * FROM backfill_lqs_sales_matching(v_agency.agency_id)
      WHERE status = 'linked'
    LOOP
      v_count := v_count + 1;
    END LOOP;
  END LOOP;
  
  RAISE NOTICE 'Backfill complete: % sales linked to LQS households', v_count;
END;
$$;
