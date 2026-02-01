-- ============================================================================
-- Fix LQS Linking Edge Cases
--
-- Issues found:
-- 1. 114 leads have matching sales but status != 'sold' (name format differences)
-- 2. ~10% of households could link to contacts by name but zip mismatch prevents it
-- ============================================================================

-- Step 1: Fix leads that have matching sales (more flexible name matching)
-- Uses LIKE pattern matching which is more forgiving than exact REGEX comparison
DO $$
DECLARE
  v_updated INT;
BEGIN
  WITH leads_with_sales AS (
    SELECT DISTINCT h.id as household_id
    FROM lqs_households h
    INNER JOIN sales s ON
      s.agency_id = h.agency_id
      AND (
        -- Match: customer_name contains last name
        UPPER(s.customer_name) LIKE '%' || UPPER(REGEXP_REPLACE(h.last_name, '[^A-Z]', '', 'gi')) || '%'
        -- And first name (if exists)
        AND (
          h.first_name IS NULL
          OR h.first_name = ''
          OR UPPER(s.customer_name) LIKE '%' || UPPER(REGEXP_REPLACE(h.first_name, '[^A-Z]', '', 'gi')) || '%'
        )
      )
    WHERE h.status != 'sold'
  )
  UPDATE lqs_households h
  SET
    status = 'sold',
    sold_date = COALESCE(h.sold_date, CURRENT_DATE),
    needs_attention = false,
    updated_at = now()
  FROM leads_with_sales lws
  WHERE h.id = lws.household_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE 'Step 1: Updated % LQS households to sold (flexible sales name match)', v_updated;
END $$;


-- Step 2: Link households to contacts by name when household_key doesn't match
-- This handles zip mismatch cases (household has 00000, contact has real zip or vice versa)
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
      (
        SELECT ac.id
        FROM agency_contacts ac
        WHERE ac.agency_id = h.agency_id
          AND UPPER(REGEXP_REPLACE(ac.last_name, '[^A-Z]', '', 'gi')) = UPPER(REGEXP_REPLACE(h.last_name, '[^A-Z]', '', 'gi'))
          AND UPPER(REGEXP_REPLACE(ac.first_name, '[^A-Z]', '', 'gi')) = UPPER(REGEXP_REPLACE(h.first_name, '[^A-Z]', '', 'gi'))
        ORDER BY ac.updated_at DESC  -- Prefer most recently updated contact
        LIMIT 1
      ) as contact_id
    FROM lqs_households h
    WHERE h.contact_id IS NULL
      AND h.first_name IS NOT NULL AND h.first_name != ''
      AND h.last_name IS NOT NULL AND h.last_name != ''
  LOOP
    IF v_rec.contact_id IS NOT NULL THEN
      UPDATE lqs_households
      SET contact_id = v_rec.contact_id, updated_at = now()
      WHERE id = v_rec.household_id;

      v_linked := v_linked + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'Step 2: Linked % LQS households to contacts by name (fallback for zip mismatch)', v_linked;
END $$;


-- Step 3: Now that more households are linked, re-run status sync for newly linked contacts
-- Check if the linked contact appears in other "customer" tables
DO $$
DECLARE
  v_updated INT;
BEGIN
  -- Update status for newly linked households where contact has cancel_audit_records
  WITH contacts_with_cancel_audit AS (
    SELECT DISTINCT h.id as household_id
    FROM lqs_households h
    INNER JOIN cancel_audit_records c ON c.contact_id = h.contact_id AND c.agency_id = h.agency_id
    WHERE h.status != 'sold'
      AND h.contact_id IS NOT NULL
  )
  UPDATE lqs_households h
  SET
    status = 'sold',
    sold_date = COALESCE(h.sold_date, CURRENT_DATE),
    needs_attention = false,
    updated_at = now()
  FROM contacts_with_cancel_audit cwca
  WHERE h.id = cwca.household_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE 'Step 3a: Updated % households to sold (linked contact has cancel audit)', v_updated;
END $$;

DO $$
DECLARE
  v_updated INT;
BEGIN
  -- Update status for newly linked households where contact has renewal success
  WITH contacts_with_renewal AS (
    SELECT DISTINCT h.id as household_id
    FROM lqs_households h
    INNER JOIN renewal_records r ON r.contact_id = h.contact_id AND r.agency_id = h.agency_id
    WHERE h.status != 'sold'
      AND h.contact_id IS NOT NULL
      AND r.current_status = 'success'
  )
  UPDATE lqs_households h
  SET
    status = 'sold',
    sold_date = COALESCE(h.sold_date, CURRENT_DATE),
    needs_attention = false,
    updated_at = now()
  FROM contacts_with_renewal cwr
  WHERE h.id = cwr.household_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE 'Step 3b: Updated % households to sold (linked contact has successful renewal)', v_updated;
END $$;

DO $$
DECLARE
  v_updated INT;
BEGIN
  -- Update status for newly linked households where contact has winback won_back
  WITH contacts_with_winback AS (
    SELECT DISTINCT h.id as household_id
    FROM lqs_households h
    INNER JOIN winback_households w ON w.contact_id = h.contact_id AND w.agency_id = h.agency_id
    WHERE h.status != 'sold'
      AND h.contact_id IS NOT NULL
      AND w.status = 'won_back'
  )
  UPDATE lqs_households h
  SET
    status = 'sold',
    sold_date = COALESCE(h.sold_date, CURRENT_DATE),
    needs_attention = false,
    updated_at = now()
  FROM contacts_with_winback cww
  WHERE h.id = cww.household_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE 'Step 3c: Updated % households to sold (linked contact has won_back winback)', v_updated;
END $$;


-- Step 4: Final stats
DO $$
DECLARE
  v_total INT;
  v_linked INT;
  v_unlinked INT;
  v_lead INT;
  v_quoted INT;
  v_sold INT;
BEGIN
  SELECT COUNT(*) INTO v_total FROM lqs_households;
  SELECT COUNT(*) INTO v_linked FROM lqs_households WHERE contact_id IS NOT NULL;
  SELECT COUNT(*) INTO v_unlinked FROM lqs_households WHERE contact_id IS NULL;
  SELECT COUNT(*) INTO v_lead FROM lqs_households WHERE status = 'lead';
  SELECT COUNT(*) INTO v_quoted FROM lqs_households WHERE status = 'quoted';
  SELECT COUNT(*) INTO v_sold FROM lqs_households WHERE status = 'sold';

  RAISE NOTICE '=== Final LQS Stats ===';
  RAISE NOTICE 'Total households: %', v_total;
  RAISE NOTICE 'Linked to contacts: % (%.1f%%)', v_linked, (v_linked::float / v_total * 100);
  RAISE NOTICE 'Not linked: % (%.1f%%)', v_unlinked, (v_unlinked::float / v_total * 100);
  RAISE NOTICE 'Status lead: %', v_lead;
  RAISE NOTICE 'Status quoted: %', v_quoted;
  RAISE NOTICE 'Status sold: %', v_sold;
END $$;
