-- ============================================================================
-- Fix: LQS Household Status Not Updating on Merge
--
-- PROBLEM: When a household already exists and new data syncs in (from scorecard,
-- quote upload, etc.), the status field was NOT being updated. A household with
-- status='lead' would stay as 'lead' even after quotes were added.
--
-- SOLUTION: Update the sync_quoted_household_to_lqs trigger to properly promote
-- status from 'lead' to 'quoted' when merging data.
-- ============================================================================

-- Step 1: Fix the sync_quoted_household_to_lqs trigger
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
  v_existing_status TEXT;
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
  v_space_pos := POSITION(' ' IN TRIM(NEW.household_name));

  IF v_space_pos > 0 THEN
    v_first_name := TRIM(SUBSTRING(TRIM(NEW.household_name) FROM 1 FOR v_space_pos - 1));
    v_last_name := TRIM(SUBSTRING(TRIM(NEW.household_name) FROM v_space_pos + 1));
    IF v_last_name = '' THEN
      v_last_name := v_first_name;
      v_first_name := 'Unknown';
    END IF;
  ELSE
    v_last_name := TRIM(NEW.household_name);
    v_first_name := 'Unknown';
  END IF;

  v_first_name := REGEXP_REPLACE(v_first_name, '[^a-zA-Z0-9]', '', 'g');
  v_last_name := REGEXP_REPLACE(v_last_name, '[^a-zA-Z0-9]', '', 'g');

  IF v_first_name = '' THEN v_first_name := 'Unknown'; END IF;
  IF v_last_name = '' THEN v_last_name := 'Unknown'; END IF;

  -- ========================================
  -- GENERATE: household_key matching dashboard format
  -- ========================================
  v_household_key := UPPER(v_last_name) || '_' || UPPER(v_first_name) || '_' || TRIM(NEW.zip_code);

  RAISE LOG 'sync_quoted_household_to_lqs: Parsed name="%" → first=%, last=%, key=%',
    NEW.household_name, v_first_name, v_last_name, v_household_key;

  -- ========================================
  -- LOOKUP: Try to find lead_source_id from label
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
  SELECT id, status INTO v_existing_id, v_existing_status
  FROM lqs_households
  WHERE agency_id = NEW.agency_id
    AND household_key = v_household_key;

  IF v_existing_id IS NOT NULL THEN
    -- ========================================
    -- UPDATE: Household exists - merge data AND update status
    -- FIX: Promote status from 'lead' to 'quoted' since we're adding quotes
    -- ========================================
    RAISE LOG 'sync_quoted_household_to_lqs: Found existing household=% with status=% for key=%',
      v_existing_id, v_existing_status, v_household_key;

    UPDATE lqs_households
    SET
      updated_at = now(),
      -- FIX: Update status from 'lead' to 'quoted' (but don't downgrade from 'sold')
      status = CASE
        WHEN lqs_households.status = 'lead' THEN 'quoted'
        ELSE lqs_households.status  -- Keep 'quoted' or 'sold' as-is
      END,
      -- Update first_quote_date if not set and we're promoting to quoted
      first_quote_date = CASE
        WHEN lqs_households.status = 'lead' AND lqs_households.first_quote_date IS NULL
        THEN NEW.work_date
        ELSE lqs_households.first_quote_date
      END,
      lead_source_id = COALESCE(lqs_households.lead_source_id, v_lead_source_id),
      team_member_id = COALESCE(lqs_households.team_member_id, NEW.team_member_id),
      needs_attention = CASE
        WHEN v_lead_source_id IS NOT NULL THEN false
        ELSE lqs_households.needs_attention
      END
    WHERE id = v_existing_id;

  ELSE
    -- ========================================
    -- INSERT: New household - create with status='quoted'
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
      skip_metrics_increment
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
      (v_lead_source_id IS NULL),
      true
    );

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
    'Bundle',
    COALESCE(NEW.items_quoted, 1),
    COALESCE(NEW.premium_potential_cents, 0),
    'scorecard',
    NEW.id
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;


-- Step 2: One-time data fix to promote existing 'lead' households that have quotes
-- This fixes the stale data from before this migration
DO $$
DECLARE
  v_updated INT;
BEGIN
  WITH households_with_quotes AS (
    SELECT DISTINCT h.id
    FROM lqs_households h
    INNER JOIN lqs_quotes q ON q.household_id = h.id
    WHERE h.status = 'lead'
  )
  UPDATE lqs_households h
  SET
    status = 'quoted',
    first_quote_date = COALESCE(h.first_quote_date, (
      SELECT MIN(q.quote_date)
      FROM lqs_quotes q
      WHERE q.household_id = h.id
    )),
    updated_at = now()
  FROM households_with_quotes hwq
  WHERE h.id = hwq.id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RAISE NOTICE 'Updated % households from lead to quoted status (had quotes but wrong status)', v_updated;
END $$;


-- Step 3: Fix households that have sales but status != 'sold'
DO $$
DECLARE
  v_updated INT;
BEGIN
  WITH households_with_sales AS (
    SELECT DISTINCT h.id
    FROM lqs_households h
    INNER JOIN lqs_sales s ON s.household_id = h.id
    WHERE h.status != 'sold'
  )
  UPDATE lqs_households h
  SET
    status = 'sold',
    sold_date = COALESCE(h.sold_date, (
      SELECT MIN(s.sale_date)
      FROM lqs_sales s
      WHERE s.household_id = h.id
    )),
    needs_attention = false,
    updated_at = now()
  FROM households_with_sales hws
  WHERE h.id = hws.id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RAISE NOTICE 'Updated % households to sold status (had sales but wrong status)', v_updated;
END $$;


-- Step 4: Add a trigger to ensure lqs_quotes insertion promotes status from 'lead' to 'quoted'
CREATE OR REPLACE FUNCTION promote_household_on_quote_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When a quote is inserted, promote household from 'lead' to 'quoted'
  UPDATE lqs_households
  SET
    status = 'quoted',
    first_quote_date = COALESCE(first_quote_date, NEW.quote_date),
    updated_at = now()
  WHERE id = NEW.household_id
    AND status = 'lead';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS promote_household_on_quote ON lqs_quotes;

CREATE TRIGGER promote_household_on_quote
  AFTER INSERT ON lqs_quotes
  FOR EACH ROW
  EXECUTE FUNCTION promote_household_on_quote_insert();


-- Step 5: Sync Winback status changes to LQS households
-- When a winback is marked as 'won_back', update linked LQS households to 'sold'
-- When a winback is marked as 'moved_to_quoted', update linked LQS households to 'quoted'
CREATE OR REPLACE FUNCTION sync_winback_status_to_lqs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact_id UUID;
BEGIN
  -- Only process status changes
  IF TG_OP != 'UPDATE' OR OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Get the contact_id from the winback household
  v_contact_id := NEW.contact_id;

  -- If winback was won back, update all LQS households for this contact to 'sold'
  IF NEW.status = 'won_back' THEN
    UPDATE lqs_households
    SET
      status = 'sold',
      sold_date = COALESCE(sold_date, CURRENT_DATE),
      needs_attention = false,
      updated_at = now()
    WHERE agency_id = NEW.agency_id
      AND contact_id = v_contact_id
      AND status != 'sold';

    RAISE LOG 'sync_winback_status_to_lqs: Winback % won_back - updated LQS households for contact % to sold',
      NEW.id, v_contact_id;
  END IF;

  -- If winback was moved to quoted, update 'lead' LQS households to 'quoted'
  IF NEW.status = 'moved_to_quoted' THEN
    UPDATE lqs_households
    SET
      status = 'quoted',
      first_quote_date = COALESCE(first_quote_date, CURRENT_DATE),
      updated_at = now()
    WHERE agency_id = NEW.agency_id
      AND contact_id = v_contact_id
      AND status = 'lead';

    RAISE LOG 'sync_winback_status_to_lqs: Winback % moved_to_quoted - updated LQS households for contact % to quoted',
      NEW.id, v_contact_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_winback_to_lqs ON winback_households;

CREATE TRIGGER sync_winback_to_lqs
  AFTER UPDATE ON winback_households
  FOR EACH ROW
  EXECUTE FUNCTION sync_winback_status_to_lqs();


-- Step 6: Sync Renewal success to LQS households
-- When a renewal is marked successful, the contact is still a customer
CREATE OR REPLACE FUNCTION sync_renewal_status_to_lqs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact_id UUID;
BEGIN
  -- Only process status changes to 'success'
  IF TG_OP != 'UPDATE' OR NEW.current_status != 'success' OR OLD.current_status = 'success' THEN
    RETURN NEW;
  END IF;

  v_contact_id := NEW.contact_id;

  -- If renewal was successful, ensure LQS households show as 'sold' (customer)
  IF v_contact_id IS NOT NULL THEN
    UPDATE lqs_households
    SET
      status = 'sold',
      sold_date = COALESCE(sold_date, NEW.renewal_effective_date, CURRENT_DATE),
      needs_attention = false,
      updated_at = now()
    WHERE agency_id = NEW.agency_id
      AND contact_id = v_contact_id
      AND status != 'sold';

    RAISE LOG 'sync_renewal_status_to_lqs: Renewal % successful - updated LQS households for contact % to sold',
      NEW.id, v_contact_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_renewal_to_lqs ON renewal_records;

CREATE TRIGGER sync_renewal_to_lqs
  AFTER UPDATE ON renewal_records
  FOR EACH ROW
  EXECUTE FUNCTION sync_renewal_status_to_lqs();


-- Step 7: One-time fix for contacts with won_back winbacks but stale LQS status
DO $$
DECLARE
  v_updated INT;
BEGIN
  -- Find contacts with won_back winbacks and update their LQS households
  WITH won_back_contacts AS (
    SELECT DISTINCT w.contact_id, w.agency_id
    FROM winback_households w
    WHERE w.status = 'won_back'
      AND w.contact_id IS NOT NULL
  )
  UPDATE lqs_households h
  SET
    status = 'sold',
    sold_date = COALESCE(h.sold_date, CURRENT_DATE),
    needs_attention = false,
    updated_at = now()
  FROM won_back_contacts wbc
  WHERE h.contact_id = wbc.contact_id
    AND h.agency_id = wbc.agency_id
    AND h.status != 'sold';

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RAISE NOTICE 'Updated % LQS households to sold status (contact had won_back winback)', v_updated;
END $$;


-- Step 8: One-time fix for contacts with successful renewals but stale LQS status
DO $$
DECLARE
  v_updated INT;
BEGIN
  -- Find contacts with successful renewals and update their LQS households
  WITH renewed_contacts AS (
    SELECT DISTINCT r.contact_id, r.agency_id
    FROM renewal_records r
    WHERE r.current_status = 'success'
      AND r.contact_id IS NOT NULL
  )
  UPDATE lqs_households h
  SET
    status = 'sold',
    sold_date = COALESCE(h.sold_date, CURRENT_DATE),
    needs_attention = false,
    updated_at = now()
  FROM renewed_contacts rc
  WHERE h.contact_id = rc.contact_id
    AND h.agency_id = rc.agency_id
    AND h.status != 'sold';

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RAISE NOTICE 'Updated % LQS households to sold status (contact had successful renewal)', v_updated;
END $$;


-- Step 9: One-time fix for contacts with moved_to_quoted winbacks but stale LQS status
DO $$
DECLARE
  v_updated INT;
BEGIN
  -- Find contacts with moved_to_quoted winbacks and update their 'lead' LQS households to 'quoted'
  WITH quoted_contacts AS (
    SELECT DISTINCT w.contact_id, w.agency_id
    FROM winback_households w
    WHERE w.status = 'moved_to_quoted'
      AND w.contact_id IS NOT NULL
  )
  UPDATE lqs_households h
  SET
    status = 'quoted',
    first_quote_date = COALESCE(h.first_quote_date, CURRENT_DATE),
    updated_at = now()
  FROM quoted_contacts qc
  WHERE h.contact_id = qc.contact_id
    AND h.agency_id = qc.agency_id
    AND h.status = 'lead';

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RAISE NOTICE 'Updated % LQS households from lead to quoted status (contact had moved_to_quoted winback)', v_updated;
END $$;


COMMENT ON FUNCTION sync_quoted_household_to_lqs() IS
  'Syncs quoted_household_details to lqs_households. Fixed in 20260131140000 to properly update status from lead to quoted.';

COMMENT ON FUNCTION promote_household_on_quote_insert() IS
  'Ensures household status is promoted to quoted when quotes are added. Added in 20260131140000.';

COMMENT ON FUNCTION sync_winback_status_to_lqs() IS
  'Syncs winback status changes to LQS households. When won_back, updates to sold. When moved_to_quoted, updates lead to quoted. Added in 20260131140000.';

COMMENT ON FUNCTION sync_renewal_status_to_lqs() IS
  'Syncs successful renewal status to LQS households, updating them to sold. Added in 20260131140000.';
