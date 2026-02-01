-- Backfill contact_id for all records that don't have one
-- This ensures every person in the system has a unified contact record

-- 1. Backfill cancel_audit_records
DO $$
DECLARE
  r RECORD;
  v_contact_id UUID;
BEGIN
  FOR r IN
    SELECT id, agency_id, insured_first_name, insured_last_name, insured_phone, insured_email
    FROM cancel_audit_records
    WHERE contact_id IS NULL
      AND insured_last_name IS NOT NULL
      AND TRIM(insured_last_name) != ''
  LOOP
    BEGIN
      v_contact_id := find_or_create_contact(
        r.agency_id,
        r.insured_first_name,
        r.insured_last_name,
        NULL,  -- no zip for cancel audit
        r.insured_phone,
        r.insured_email
      );

      IF v_contact_id IS NOT NULL THEN
        UPDATE cancel_audit_records
        SET contact_id = v_contact_id
        WHERE id = r.id;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to create contact for cancel_audit_record %: %', r.id, SQLERRM;
    END;
  END LOOP;
END $$;

-- 2. Backfill winback_households
DO $$
DECLARE
  r RECORD;
  v_contact_id UUID;
BEGIN
  FOR r IN
    SELECT id, agency_id, first_name, last_name, zip_code, phone, email
    FROM winback_households
    WHERE contact_id IS NULL
      AND last_name IS NOT NULL
      AND TRIM(last_name) != ''
  LOOP
    BEGIN
      v_contact_id := find_or_create_contact(
        r.agency_id,
        r.first_name,
        r.last_name,
        r.zip_code,
        r.phone,
        r.email
      );

      IF v_contact_id IS NOT NULL THEN
        UPDATE winback_households
        SET contact_id = v_contact_id
        WHERE id = r.id;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to create contact for winback_household %: %', r.id, SQLERRM;
    END;
  END LOOP;
END $$;

-- 3. Backfill renewal_records
DO $$
DECLARE
  r RECORD;
  v_contact_id UUID;
BEGIN
  FOR r IN
    SELECT id, agency_id, first_name, last_name, phone, email
    FROM renewal_records
    WHERE contact_id IS NULL
      AND last_name IS NOT NULL
      AND TRIM(last_name) != ''
  LOOP
    BEGIN
      v_contact_id := find_or_create_contact(
        r.agency_id,
        r.first_name,
        r.last_name,
        NULL,  -- no zip stored on renewal_records
        r.phone,
        r.email
      );

      IF v_contact_id IS NOT NULL THEN
        UPDATE renewal_records
        SET contact_id = v_contact_id
        WHERE id = r.id;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to create contact for renewal_record %: %', r.id, SQLERRM;
    END;
  END LOOP;
END $$;

-- 4. Backfill lqs_households
DO $$
DECLARE
  r RECORD;
  v_contact_id UUID;
  v_phone TEXT;
BEGIN
  FOR r IN
    SELECT id, agency_id, first_name, last_name, zip_code, phone, email
    FROM lqs_households
    WHERE contact_id IS NULL
      AND last_name IS NOT NULL
      AND TRIM(last_name) != ''
  LOOP
    BEGIN
      -- lqs_households.phone is an array, get first element
      v_phone := CASE WHEN r.phone IS NOT NULL AND array_length(r.phone, 1) > 0
                      THEN r.phone[1]
                      ELSE NULL
                 END;

      v_contact_id := find_or_create_contact(
        r.agency_id,
        r.first_name,
        r.last_name,
        r.zip_code,
        v_phone,
        r.email
      );

      IF v_contact_id IS NOT NULL THEN
        UPDATE lqs_households
        SET contact_id = v_contact_id
        WHERE id = r.id;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to create contact for lqs_household %: %', r.id, SQLERRM;
    END;
  END LOOP;
END $$;

-- Report results
DO $$
DECLARE
  v_cancel_with_contact INT;
  v_cancel_without_contact INT;
  v_winback_with_contact INT;
  v_winback_without_contact INT;
  v_renewal_with_contact INT;
  v_renewal_without_contact INT;
  v_lqs_with_contact INT;
  v_lqs_without_contact INT;
BEGIN
  SELECT COUNT(*) INTO v_cancel_with_contact FROM cancel_audit_records WHERE contact_id IS NOT NULL;
  SELECT COUNT(*) INTO v_cancel_without_contact FROM cancel_audit_records WHERE contact_id IS NULL;
  SELECT COUNT(*) INTO v_winback_with_contact FROM winback_households WHERE contact_id IS NOT NULL;
  SELECT COUNT(*) INTO v_winback_without_contact FROM winback_households WHERE contact_id IS NULL;
  SELECT COUNT(*) INTO v_renewal_with_contact FROM renewal_records WHERE contact_id IS NOT NULL;
  SELECT COUNT(*) INTO v_renewal_without_contact FROM renewal_records WHERE contact_id IS NULL;
  SELECT COUNT(*) INTO v_lqs_with_contact FROM lqs_households WHERE contact_id IS NOT NULL;
  SELECT COUNT(*) INTO v_lqs_without_contact FROM lqs_households WHERE contact_id IS NULL;

  RAISE NOTICE 'Backfill complete:';
  RAISE NOTICE '  cancel_audit_records: % with contact, % without', v_cancel_with_contact, v_cancel_without_contact;
  RAISE NOTICE '  winback_households: % with contact, % without', v_winback_with_contact, v_winback_without_contact;
  RAISE NOTICE '  renewal_records: % with contact, % without', v_renewal_with_contact, v_renewal_without_contact;
  RAISE NOTICE '  lqs_households: % with contact, % without', v_lqs_with_contact, v_lqs_without_contact;
END $$;
