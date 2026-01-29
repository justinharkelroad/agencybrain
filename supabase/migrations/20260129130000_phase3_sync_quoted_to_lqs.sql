-- ============================================================================
-- Phase 3: Sync quoted_household_details → lqs_households
--
-- When a scorecard creates quoted_household_details records, this trigger
-- syncs them to lqs_households with deduplication via household_key.
-- ============================================================================

-- STEP 1: Create the sync trigger function
CREATE OR REPLACE FUNCTION sync_quoted_household_to_lqs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_household_key TEXT;
  v_first_name TEXT;
  v_last_name TEXT;
  v_existing_id UUID;
  v_lead_source_id UUID;
  v_space_pos INT;
BEGIN
  -- ========================================
  -- GUARD: Skip if zip_code is NULL or empty
  -- ========================================
  IF NEW.zip_code IS NULL OR TRIM(NEW.zip_code) = '' THEN
    RAISE LOG 'sync_quoted_household_to_lqs: Skipping - no zip_code for detail=%, household=%',
      NEW.id, NEW.household_name;
    RETURN NEW;
  END IF;

  -- ========================================
  -- PARSE: Extract first/last name from "First Last" format
  -- ========================================
  -- Find position of first space
  v_space_pos := POSITION(' ' IN TRIM(NEW.household_name));

  IF v_space_pos > 0 THEN
    -- Has space: split into first and last
    v_first_name := TRIM(SUBSTRING(TRIM(NEW.household_name) FROM 1 FOR v_space_pos - 1));
    v_last_name := TRIM(SUBSTRING(TRIM(NEW.household_name) FROM v_space_pos + 1));

    -- Handle edge case: multiple spaces (e.g., "John Van Der Berg")
    -- Last name is everything after first space
    IF v_last_name = '' THEN
      v_last_name := v_first_name;
      v_first_name := 'Unknown';
    END IF;
  ELSE
    -- No space: treat entire name as last name (common for single-word entries like "Smith")
    v_last_name := TRIM(NEW.household_name);
    v_first_name := 'Unknown';
  END IF;

  -- Sanitize: Remove any non-alphanumeric chars that could break the key
  v_first_name := REGEXP_REPLACE(v_first_name, '[^a-zA-Z0-9]', '', 'g');
  v_last_name := REGEXP_REPLACE(v_last_name, '[^a-zA-Z0-9]', '', 'g');

  -- Final guard: ensure we have valid name components
  IF v_first_name = '' THEN v_first_name := 'Unknown'; END IF;
  IF v_last_name = '' THEN v_last_name := 'Unknown'; END IF;

  -- ========================================
  -- GENERATE: household_key matching dashboard format
  -- Format: LASTNAME_FIRSTNAME_ZIP
  -- ========================================
  v_household_key := UPPER(v_last_name) || '_' || UPPER(v_first_name) || '_' || TRIM(NEW.zip_code);

  RAISE LOG 'sync_quoted_household_to_lqs: Parsed name="%" → first=%, last=%, key=%',
    NEW.household_name, v_first_name, v_last_name, v_household_key;

  -- ========================================
  -- LOOKUP: Try to find lead_source_id from label
  -- (quoted_household_details stores label, not ID)
  -- ========================================
  IF NEW.lead_source_label IS NOT NULL AND NEW.lead_source_label != '' THEN
    SELECT id INTO v_lead_source_id
    FROM lead_sources
    WHERE agency_id = NEW.agency_id
      AND name = NEW.lead_source_label
    LIMIT 1;
  END IF;

  -- ========================================
  -- DEDUP CHECK: Does household_key already exist?
  -- ========================================
  SELECT id INTO v_existing_id
  FROM lqs_households
  WHERE agency_id = NEW.agency_id
    AND household_key = v_household_key;

  IF v_existing_id IS NOT NULL THEN
    -- ========================================
    -- UPDATE: Household exists - merge data, no metrics increment
    -- ========================================
    RAISE LOG 'sync_quoted_household_to_lqs: Found existing household=% for key=%', v_existing_id, v_household_key;

    UPDATE lqs_households
    SET
      updated_at = now(),
      -- Update lead source if we have one and they don't
      lead_source_id = COALESCE(lqs_households.lead_source_id, v_lead_source_id),
      -- Update team member if we have one and they don't
      team_member_id = COALESCE(lqs_households.team_member_id, NEW.team_member_id),
      -- Clear needs_attention if we're providing lead source
      needs_attention = CASE
        WHEN v_lead_source_id IS NOT NULL THEN false
        ELSE lqs_households.needs_attention
      END
    WHERE id = v_existing_id;

  ELSE
    -- ========================================
    -- INSERT: New household - create with skip_metrics_increment = true
    -- (scorecard already incremented metrics via upsert_metrics_from_submission)
    -- ========================================
    RAISE LOG 'sync_quoted_household_to_lqs: Creating new household for key=% with skip_metrics=true', v_household_key;

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
      needs_attention,
      skip_metrics_increment  -- CRITICAL: prevents double-counting
    )
    VALUES (
      NEW.agency_id,
      v_household_key,
      INITCAP(v_first_name),
      INITCAP(v_last_name),
      TRIM(NEW.zip_code),
      'quoted',
      NEW.team_member_id,
      NEW.work_date,
      v_lead_source_id,
      (v_lead_source_id IS NULL),  -- needs_attention if no lead source
      true  -- SKIP metrics - scorecard already counted via upsert_metrics_from_submission
    );

    -- Get the ID of the newly created household
    SELECT id INTO v_existing_id
    FROM lqs_households
    WHERE agency_id = NEW.agency_id AND household_key = v_household_key;
  END IF;

  -- ========================================
  -- CREATE: lqs_quotes record for detailed tracking
  -- ========================================
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
    v_existing_id,
    NEW.agency_id,
    NEW.team_member_id,
    NEW.work_date,
    'Bundle',  -- Default product type for scorecard entries
    COALESCE(NEW.items_quoted, 1),
    COALESCE(NEW.premium_potential_cents, 0),
    'scorecard',
    NEW.id  -- Reference back to quoted_household_details
  )
  ON CONFLICT DO NOTHING;  -- Prevent duplicate quotes if trigger fires twice

  RETURN NEW;
END;
$$;


-- STEP 2: Register the trigger on quoted_household_details
DROP TRIGGER IF EXISTS quoted_household_details_sync_to_lqs ON quoted_household_details;

CREATE TRIGGER quoted_household_details_sync_to_lqs
  AFTER INSERT ON quoted_household_details
  FOR EACH ROW
  EXECUTE FUNCTION sync_quoted_household_to_lqs();


-- STEP 3: Verify unique constraint exists (should already exist from initial schema)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'lqs_households_agency_key_unique'
  ) THEN
    ALTER TABLE lqs_households
    ADD CONSTRAINT lqs_households_agency_key_unique
    UNIQUE (agency_id, household_key);
    RAISE NOTICE 'Added unique constraint on (agency_id, household_key)';
  ELSE
    RAISE NOTICE 'Unique constraint lqs_households_agency_key_unique already exists';
  END IF;
END $$;
