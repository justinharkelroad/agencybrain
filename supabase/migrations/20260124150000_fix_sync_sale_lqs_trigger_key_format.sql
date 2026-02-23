DO $$
BEGIN
  IF to_regclass('public.sales') IS NULL THEN
    RAISE NOTICE 'Skipping % because public.sales does not exist.', '20260124150000_fix_sync_sale_lqs_trigger_key_format';
    RETURN;
  END IF;

  -- Drop the sync_sale_to_lqs trigger
  -- This trigger was causing issues:
  -- 1. Wrong household key format (FIRSTNAME_LASTNAME instead of LASTNAME_FIRSTNAME)
  -- 2. Type mismatch errors on phone column
  -- 3. Redundant - the edge function create_staff_sale already handles LQS household creation
  --
  -- The edge function provides better LQS pipeline creation with:
  -- - Phone-based matching to find existing households
  -- - Correct LASTNAME_FIRSTNAME_ZIP key format
  -- - Proper lead_source_id passthrough
  DROP TRIGGER IF EXISTS sync_sale_to_lqs_trigger ON sales;

  -- Also drop the function since it's no longer needed
  DROP FUNCTION IF EXISTS public.sync_sale_to_lqs();
END $$;
