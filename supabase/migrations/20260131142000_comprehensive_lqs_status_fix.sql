-- ============================================================================
-- Comprehensive LQS Status Fix
--
-- PROBLEM: Some LQS households have status='lead' but the contact is actually
-- a customer. This happens when:
-- 1. The LQS household has no contact_id (can't be synced)
-- 2. The contact became a customer through a path that didn't update LQS
--
-- SOLUTION: Match LQS households to other systems by name/zip and update status
-- ============================================================================

-- Step 1: Link LQS households to contacts if not already linked
-- Match by household_key pattern (LASTNAME_FIRSTNAME_ZIP)
DO $$
DECLARE
  v_linked INT := 0;
  v_rec RECORD;
BEGIN
  FOR v_rec IN
    SELECT
      h.id as household_id,
      h.agency_id,
      h.first_name,
      h.last_name,
      h.zip_code,
      c.id as contact_id
    FROM lqs_households h
    CROSS JOIN LATERAL (
      SELECT ac.id
      FROM agency_contacts ac
      WHERE ac.agency_id = h.agency_id
        AND ac.household_key = h.household_key
      LIMIT 1
    ) c
    WHERE h.contact_id IS NULL
  LOOP
    UPDATE lqs_households
    SET contact_id = v_rec.contact_id, updated_at = now()
    WHERE id = v_rec.household_id;

    v_linked := v_linked + 1;
  END LOOP;

  RAISE NOTICE 'Linked % LQS households to contacts by household_key', v_linked;
END $$;


-- Step 2: Find LQS households where contact has sales in the sales table
-- (even if not linked through lqs_sales)
DO $$
DECLARE
  v_updated INT;
BEGIN
  WITH customers_with_sales AS (
    SELECT DISTINCT h.id as household_id
    FROM lqs_households h
    INNER JOIN sales s ON
      s.agency_id = h.agency_id
      AND UPPER(REGEXP_REPLACE(
        SPLIT_PART(s.customer_name, ' ', array_length(string_to_array(s.customer_name, ' '), 1)),
        '[^A-Z]', '', 'g'
      )) = UPPER(REGEXP_REPLACE(h.last_name, '[^A-Z]', '', 'g'))
      AND UPPER(REGEXP_REPLACE(
        SPLIT_PART(s.customer_name, ' ', 1),
        '[^A-Z]', '', 'g'
      )) = UPPER(REGEXP_REPLACE(h.first_name, '[^A-Z]', '', 'g'))
      AND COALESCE(s.customer_zip, '') = COALESCE(h.zip_code, '')
    WHERE h.status != 'sold'
  )
  UPDATE lqs_households h
  SET
    status = 'sold',
    sold_date = COALESCE(h.sold_date, CURRENT_DATE),
    needs_attention = false,
    updated_at = now()
  FROM customers_with_sales cws
  WHERE h.id = cws.household_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE 'Updated % LQS households to sold (matched to sales table by name/zip)', v_updated;
END $$;


-- Step 3: Find LQS households where the same name/zip exists in winback with won_back
DO $$
DECLARE
  v_updated INT;
BEGIN
  WITH won_back_matches AS (
    SELECT DISTINCT h.id as household_id
    FROM lqs_households h
    INNER JOIN winback_households w ON
      w.agency_id = h.agency_id
      AND UPPER(REGEXP_REPLACE(w.last_name, '[^A-Z]', '', 'g')) = UPPER(REGEXP_REPLACE(h.last_name, '[^A-Z]', '', 'g'))
      AND UPPER(REGEXP_REPLACE(w.first_name, '[^A-Z]', '', 'g')) = UPPER(REGEXP_REPLACE(h.first_name, '[^A-Z]', '', 'g'))
      AND COALESCE(w.zip_code, '') = COALESCE(h.zip_code, '')
      AND w.status = 'won_back'
    WHERE h.status != 'sold'
  )
  UPDATE lqs_households h
  SET
    status = 'sold',
    sold_date = COALESCE(h.sold_date, CURRENT_DATE),
    needs_attention = false,
    updated_at = now()
  FROM won_back_matches wbm
  WHERE h.id = wbm.household_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE 'Updated % LQS households to sold (matched to won_back winback by name/zip)', v_updated;
END $$;


-- Step 4: Find LQS households where the same name exists in cancel_audit
-- (having a cancel audit means they were a customer)
-- Note: cancel_audit_records uses insured_first_name, insured_last_name
DO $$
DECLARE
  v_updated INT;
BEGIN
  WITH cancel_audit_matches AS (
    SELECT DISTINCT h.id as household_id
    FROM lqs_households h
    INNER JOIN cancel_audit_records c ON
      c.agency_id = h.agency_id
      AND UPPER(REGEXP_REPLACE(COALESCE(c.insured_last_name, ''), '[^A-Z]', '', 'g')) = UPPER(REGEXP_REPLACE(h.last_name, '[^A-Z]', '', 'g'))
      AND UPPER(REGEXP_REPLACE(COALESCE(c.insured_first_name, ''), '[^A-Z]', '', 'g')) = UPPER(REGEXP_REPLACE(h.first_name, '[^A-Z]', '', 'g'))
    WHERE h.status != 'sold'
      AND c.insured_last_name IS NOT NULL
      AND c.insured_first_name IS NOT NULL
  )
  UPDATE lqs_households h
  SET
    status = 'sold',
    sold_date = COALESCE(h.sold_date, CURRENT_DATE),
    needs_attention = false,
    updated_at = now()
  FROM cancel_audit_matches cam
  WHERE h.id = cam.household_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE 'Updated % LQS households to sold (matched to cancel_audit by name)', v_updated;
END $$;


-- Step 5: Find LQS households where the same name exists in renewal_records with success
-- Note: renewal_records columns were renamed to first_name, last_name
DO $$
DECLARE
  v_updated INT;
BEGIN
  WITH renewal_success_matches AS (
    SELECT DISTINCT h.id as household_id
    FROM lqs_households h
    INNER JOIN renewal_records r ON
      r.agency_id = h.agency_id
      AND UPPER(REGEXP_REPLACE(COALESCE(r.last_name, ''), '[^A-Z]', '', 'g')) = UPPER(REGEXP_REPLACE(h.last_name, '[^A-Z]', '', 'g'))
      AND UPPER(REGEXP_REPLACE(COALESCE(r.first_name, ''), '[^A-Z]', '', 'g')) = UPPER(REGEXP_REPLACE(h.first_name, '[^A-Z]', '', 'g'))
      AND r.current_status = 'success'
    WHERE h.status != 'sold'
      AND r.last_name IS NOT NULL
      AND r.first_name IS NOT NULL
  )
  UPDATE lqs_households h
  SET
    status = 'sold',
    sold_date = COALESCE(h.sold_date, CURRENT_DATE),
    needs_attention = false,
    updated_at = now()
  FROM renewal_success_matches rsm
  WHERE h.id = rsm.household_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE 'Updated % LQS households to sold (matched to successful renewal by name)', v_updated;
END $$;


-- Step 6: Find LQS households where contact has lqs_sales in another household
-- (same contact_id, different household, has sales)
DO $$
DECLARE
  v_updated INT;
BEGIN
  WITH contacts_with_other_sales AS (
    SELECT DISTINCT h1.id as household_id
    FROM lqs_households h1
    INNER JOIN lqs_households h2 ON
      h2.contact_id = h1.contact_id
      AND h2.id != h1.id
      AND h2.status = 'sold'
    WHERE h1.status != 'sold'
      AND h1.contact_id IS NOT NULL
  )
  UPDATE lqs_households h
  SET
    status = 'sold',
    sold_date = COALESCE(h.sold_date, CURRENT_DATE),
    needs_attention = false,
    updated_at = now()
  FROM contacts_with_other_sales cwos
  WHERE h.id = cwos.household_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE 'Updated % LQS households to sold (same contact has another sold household)', v_updated;
END $$;


-- Step 7: Log remaining leads that might be stale
-- (for debugging - households still at 'lead' status)
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM lqs_households
  WHERE status = 'lead';

  RAISE NOTICE 'Remaining LQS households with status=lead: %', v_count;
END $$;
