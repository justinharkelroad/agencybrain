-- Phase 2B: Normalize household keys from NOZIP to 00000
--
-- This migration:
-- 1. Detects collisions between _NOZIP and _00000 keys
-- 2. Merges duplicates preserving all data
-- 3. Re-points FK references before deletion
-- 4. Normalizes remaining NOZIP keys to 00000
--
-- FK References to agency_contacts:
-- - lqs_households.contact_id (no ON DELETE)
-- - cancel_audit_records.contact_id (no ON DELETE)
-- - renewal_records.contact_id (no ON DELETE)
-- - winback_households.contact_id (no ON DELETE)
-- - contact_activities.contact_id (CASCADE)
-- - onboarding_instances.contact_id (SET NULL)
-- - onboarding_tasks.contact_id (SET NULL)
--
-- FK References to lqs_households: NONE (safe to delete)

-- Step 1: Handle agency_contacts collisions (NOZIP → 00000 merge)
DO $$
DECLARE
  v_rec RECORD;
BEGIN
  FOR v_rec IN (
    SELECT c1.id as nozip_id, c2.id as target_id
    FROM agency_contacts c1
    JOIN agency_contacts c2 ON
      c1.agency_id = c2.agency_id
      AND REPLACE(c1.household_key, '_NOZIP', '_00000') = c2.household_key
    WHERE c1.household_key LIKE '%_NOZIP'
      AND c2.household_key LIKE '%_00000'
  )
  LOOP
    -- Re-point all FK references from nozip contact to target contact
    UPDATE lqs_households SET contact_id = v_rec.target_id WHERE contact_id = v_rec.nozip_id;
    UPDATE cancel_audit_records SET contact_id = v_rec.target_id WHERE contact_id = v_rec.nozip_id;
    UPDATE renewal_records SET contact_id = v_rec.target_id WHERE contact_id = v_rec.nozip_id;
    UPDATE winback_households SET contact_id = v_rec.target_id WHERE contact_id = v_rec.nozip_id;
    UPDATE contact_activities SET contact_id = v_rec.target_id WHERE contact_id = v_rec.nozip_id;
    UPDATE onboarding_instances SET contact_id = v_rec.target_id WHERE contact_id = v_rec.nozip_id;
    UPDATE onboarding_tasks SET contact_id = v_rec.target_id WHERE contact_id = v_rec.nozip_id;

    -- Merge phone/email arrays from NOZIP into target
    UPDATE agency_contacts
    SET
      phones = (
        SELECT array_agg(DISTINCT p)
        FROM unnest(
          COALESCE(agency_contacts.phones, '{}') ||
          COALESCE((SELECT phones FROM agency_contacts WHERE id = v_rec.nozip_id), '{}')
        ) AS p
        WHERE p IS NOT NULL
      ),
      emails = (
        SELECT array_agg(DISTINCT e)
        FROM unnest(
          COALESCE(agency_contacts.emails, '{}') ||
          COALESCE((SELECT emails FROM agency_contacts WHERE id = v_rec.nozip_id), '{}')
        ) AS e
        WHERE e IS NOT NULL
      ),
      updated_at = now()
    WHERE id = v_rec.target_id;

    -- Delete the NOZIP duplicate (FK references already re-pointed)
    DELETE FROM agency_contacts WHERE id = v_rec.nozip_id;

    RAISE LOG 'Merged agency_contacts % into %', v_rec.nozip_id, v_rec.target_id;
  END LOOP;
END $$;

-- Step 2: Normalize remaining NOZIP keys in agency_contacts (no collisions)
UPDATE agency_contacts
SET
  household_key = REPLACE(household_key, '_NOZIP', '_00000'),
  updated_at = now()
WHERE household_key LIKE '%_NOZIP';

-- Step 3: Handle lqs_households collisions (NOZIP → 00000 merge)
DO $$
DECLARE
  v_rec RECORD;
  v_source lqs_households%ROWTYPE;
BEGIN
  FOR v_rec IN (
    SELECT h1.id as nozip_id, h2.id as target_id
    FROM lqs_households h1
    JOIN lqs_households h2 ON
      h1.agency_id = h2.agency_id
      AND REPLACE(h1.household_key, '_NOZIP', '_00000') = h2.household_key
    WHERE h1.household_key LIKE '%_NOZIP'
      AND h2.household_key LIKE '%_00000'
  )
  LOOP
    -- Get source record
    SELECT * INTO v_source FROM lqs_households WHERE id = v_rec.nozip_id;

    -- Merge: prefer target values, fill gaps from source
    UPDATE lqs_households
    SET
      -- Contact info
      phone = COALESCE(phone, v_source.phone),
      email = COALESCE(email, v_source.email),
      -- Status transitions (prefer more advanced status)
      status = CASE
        WHEN status = 'sold' THEN status
        WHEN v_source.status = 'sold' THEN 'sold'
        WHEN status = 'quoted' THEN status
        WHEN v_source.status = 'quoted' THEN 'quoted'
        ELSE status
      END,
      -- Dates (prefer earlier dates for received, later for sold)
      lead_received_date = LEAST(COALESCE(lead_received_date, v_source.lead_received_date), v_source.lead_received_date),
      first_quote_date = LEAST(COALESCE(first_quote_date, v_source.first_quote_date), v_source.first_quote_date),
      sold_date = COALESCE(sold_date, v_source.sold_date),
      -- Attribution (prefer existing)
      lead_source_id = COALESCE(lead_source_id, v_source.lead_source_id),
      team_member_id = COALESCE(team_member_id, v_source.team_member_id),
      -- Content fields
      notes = COALESCE(notes, v_source.notes),
      products_interested = COALESCE(products_interested, v_source.products_interested),
      needs_attention = needs_attention OR v_source.needs_attention,
      -- Contact linking
      contact_id = COALESCE(contact_id, v_source.contact_id),
      updated_at = now()
    WHERE id = v_rec.target_id;

    -- lqs_households has NO foreign key references pointing to it, safe to delete
    DELETE FROM lqs_households WHERE id = v_rec.nozip_id;

    RAISE LOG 'Merged lqs_households % into %', v_rec.nozip_id, v_rec.target_id;
  END LOOP;
END $$;

-- Step 4: Normalize remaining NOZIP keys in lqs_households (no collisions)
UPDATE lqs_households
SET
  household_key = REPLACE(household_key, '_NOZIP', '_00000'),
  updated_at = now()
WHERE household_key LIKE '%_NOZIP';

-- Verification queries:
-- SELECT COUNT(*) FROM agency_contacts WHERE household_key LIKE '%_NOZIP';  -- Should be 0
-- SELECT COUNT(*) FROM lqs_households WHERE household_key LIKE '%_NOZIP';   -- Should be 0
