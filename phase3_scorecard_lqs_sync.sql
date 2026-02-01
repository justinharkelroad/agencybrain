-- ============================================================================
-- PHASE 3: Scorecard → LQS Sync with Deduplication
-- 
-- Purpose: When scorecard creates quoted_household_details, automatically
--          sync to lqs_households with deduplication based on household_key
--
-- PREREQUISITES: 
--   - Phase 1 must be verified working (trigger on lqs_households)
--   - Phase 2 must be verified working (zip_code being collected)
--
-- See LQS_METRICS_SYNC_IMPLEMENTATION.md for full plan.
-- ============================================================================


-- ============================================================================
-- STEP 1: Add unique constraint for deduplication
-- ============================================================================

-- Check if constraint already exists before creating
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'lqs_households_agency_key_unique'
  ) THEN
    ALTER TABLE lqs_households
    ADD CONSTRAINT lqs_households_agency_key_unique 
    UNIQUE (agency_id, household_key);
    RAISE NOTICE 'Created unique constraint lqs_households_agency_key_unique';
  ELSE
    RAISE NOTICE 'Constraint lqs_households_agency_key_unique already exists';
  END IF;
END $$;


-- ============================================================================
-- STEP 2: Create the sync function
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_quoted_household_to_lqs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_household_key text;
  v_first_name text;
  v_last_name text;
  v_name_parts text[];
  v_existing_id uuid;
  v_new_household_id uuid;
BEGIN
  -- ==========================================================================
  -- VALIDATION: Skip if no zip code (can't generate proper key for matching)
  -- ==========================================================================
  IF NEW.zip_code IS NULL OR TRIM(NEW.zip_code) = '' THEN
    RAISE LOG 'sync_quoted_household_to_lqs: Skipping - no zip_code for detail_id=%', NEW.id;
    RETURN NEW;
  END IF;

  IF NEW.household_name IS NULL OR TRIM(NEW.household_name) = '' THEN
    RAISE LOG 'sync_quoted_household_to_lqs: Skipping - no household_name for detail_id=%', NEW.id;
    RETURN NEW;
  END IF;

  -- ==========================================================================
  -- PARSE NAME: Split "First Last" into components
  -- ==========================================================================
  -- Handle various formats: "John Smith", "John", "John Paul Smith"
  v_name_parts := string_to_array(TRIM(NEW.household_name), ' ');
  
  IF array_length(v_name_parts, 1) >= 2 THEN
    -- "John Smith" or "John Paul Smith" -> first = John, last = everything else
    v_first_name := v_name_parts[1];
    v_last_name := array_to_string(v_name_parts[2:], ' ');
  ELSIF array_length(v_name_parts, 1) = 1 THEN
    -- Single name "John" -> treat as last name
    v_first_name := 'Unknown';
    v_last_name := v_name_parts[1];
  ELSE
    -- Empty or weird input
    RAISE LOG 'sync_quoted_household_to_lqs: Cannot parse name "%" for detail_id=%', NEW.household_name, NEW.id;
    RETURN NEW;
  END IF;

  -- ==========================================================================
  -- GENERATE HOUSEHOLD KEY: Matches dashboard format LASTNAME_FIRSTNAME_ZIP
  -- ==========================================================================
  v_household_key := UPPER(TRIM(v_last_name)) || '_' || UPPER(TRIM(v_first_name)) || '_' || TRIM(NEW.zip_code);

  RAISE LOG 'sync_quoted_household_to_lqs: Generated key=% for detail_id=%, name="%"', 
    v_household_key, NEW.id, NEW.household_name;

  -- ==========================================================================
  -- DEDUPLICATION CHECK: Does this household already exist?
  -- ==========================================================================
  SELECT id INTO v_existing_id
  FROM lqs_households
  WHERE agency_id = NEW.agency_id
    AND household_key = v_household_key;

  IF v_existing_id IS NOT NULL THEN
    -- ========================================================================
    -- HOUSEHOLD EXISTS: Update it, do NOT increment metrics (already counted)
    -- ========================================================================
    RAISE LOG 'sync_quoted_household_to_lqs: Found existing household=% for key=%', 
      v_existing_id, v_household_key;
    
    UPDATE lqs_households
    SET 
      updated_at = now(),
      -- Append note about scorecard reference
      notes = CASE 
        WHEN notes IS NULL OR notes = '' THEN 'Scorecard ref: ' || NEW.id::text
        ELSE notes || E'\nScorecard ref: ' || NEW.id::text
      END
    WHERE id = v_existing_id;
    
    v_new_household_id := v_existing_id;
    
  ELSE
    -- ========================================================================
    -- NEW HOUSEHOLD: Create with skip_metrics_increment = true
    -- (Scorecard already counted this via upsert_metrics_from_submission)
    -- ========================================================================
    RAISE LOG 'sync_quoted_household_to_lqs: Creating new household for key=%', v_household_key;
    
    INSERT INTO lqs_households (
      agency_id,
      household_key,
      first_name,
      last_name,
      zip_code,
      status,
      team_member_id,
      first_quote_date,
      lead_source_id,
      notes,
      skip_metrics_increment  -- CRITICAL: Prevents double-counting
    )
    VALUES (
      NEW.agency_id,
      v_household_key,
      v_first_name,
      v_last_name,
      TRIM(NEW.zip_code),
      'quoted',
      NEW.team_member_id,
      NEW.work_date,
      NEW.lead_source_id,
      'From scorecard: ' || NEW.id::text,
      true  -- Skip metrics increment - scorecard already counted via upsert_metrics_from_submission
    )
    RETURNING id INTO v_new_household_id;
  END IF;

  -- ==========================================================================
  -- CREATE LQS_QUOTE RECORD: Track the quote details
  -- ==========================================================================
  -- Use ON CONFLICT DO NOTHING to handle potential duplicates
  INSERT INTO lqs_quotes (
    household_id,
    agency_id,
    team_member_id,
    quote_date,
    product_type,
    items_quoted,
    premium_cents,
    source,
    source_reference_id
  )
  VALUES (
    v_new_household_id,
    NEW.agency_id,
    NEW.team_member_id,
    COALESCE(NEW.work_date, CURRENT_DATE),
    'Bundle',  -- Default product type
    COALESCE(NEW.items_quoted, 1),
    COALESCE(NEW.premium_potential_cents, 0),
    'scorecard',  -- Mark source for tracking
    NEW.id  -- Reference back to quoted_household_details
  )
  ON CONFLICT DO NOTHING;

  RAISE LOG 'sync_quoted_household_to_lqs: Complete for detail_id=%, household_id=%', NEW.id, v_new_household_id;

  RETURN NEW;
END;
$$;


-- ============================================================================
-- STEP 3: Register the trigger on quoted_household_details
-- ============================================================================

DROP TRIGGER IF EXISTS quoted_household_details_sync_to_lqs ON quoted_household_details;

CREATE TRIGGER quoted_household_details_sync_to_lqs
  AFTER INSERT ON quoted_household_details
  FOR EACH ROW
  EXECUTE FUNCTION sync_quoted_household_to_lqs();


-- ============================================================================
-- PHASE 3 VERIFICATION QUERIES
-- ============================================================================

-- Check 1: Unique constraint exists
SELECT 'Unique constraint check' as test,
  CASE WHEN COUNT(*) = 1 THEN '✅ PASS' ELSE '❌ FAIL' END as result
FROM pg_constraint 
WHERE conname = 'lqs_households_agency_key_unique';

-- Check 2: Sync function exists
SELECT 'Sync function check' as test,
  CASE WHEN COUNT(*) = 1 THEN '✅ PASS' ELSE '❌ FAIL' END as result
FROM information_schema.routines 
WHERE routine_name = 'sync_quoted_household_to_lqs';

-- Check 3: Trigger exists
SELECT 'Trigger check' as test,
  CASE WHEN COUNT(*) = 1 THEN '✅ PASS' ELSE '❌ FAIL' END as result
FROM pg_trigger 
WHERE tgrelid = 'quoted_household_details'::regclass
  AND tgname = 'quoted_household_details_sync_to_lqs';


-- ============================================================================
-- PHASE 3 TEST SCENARIOS
-- ============================================================================

-- TEST 1: Submit scorecard with new household
-- 1. Submit a scorecard with "John Doe, 12345" in quotedDetails
-- 2. Run this query to verify LQS record was created:
--
-- SELECT id, household_key, first_name, last_name, zip_code, 
--        skip_metrics_increment, created_at
-- FROM lqs_households 
-- WHERE household_key = 'DOE_JOHN_12345'
-- ORDER BY created_at DESC;
--
-- Expected: 1 row, skip_metrics_increment should be FALSE (was reset by trigger)


-- TEST 2: Dashboard first, then scorecard (dedup test)
-- 1. Add "Jane Smith, 90210" via dashboard
-- 2. Check metrics_daily.quoted_count
-- 3. Submit scorecard mentioning "Jane Smith, 90210"
-- 4. Verify NO duplicate household:
--
-- SELECT COUNT(*) FROM lqs_households 
-- WHERE household_key = 'SMITH_JANE_90210';
-- Expected: 1
--
-- 5. Verify metrics did NOT double-increment


-- TEST 3: Scorecard first, then dashboard (dedup test)
-- 1. Submit scorecard with "Bob Jones, 55555"
-- 2. Note metrics_daily.quoted_count
-- 3. Try to add "Bob Jones, 55555" via dashboard
-- 4. Dashboard should find existing record (UPDATE, not INSERT)
-- 5. Verify metrics did NOT increment again


-- ============================================================================
-- PHASE 3 ROLLBACK (if needed)
-- ============================================================================

-- DROP TRIGGER IF EXISTS quoted_household_details_sync_to_lqs ON quoted_household_details;
-- DROP FUNCTION IF EXISTS sync_quoted_household_to_lqs();
-- ALTER TABLE lqs_households DROP CONSTRAINT IF EXISTS lqs_households_agency_key_unique;
