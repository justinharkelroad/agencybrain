-- Backfill remaining contact_id values after superuser access fix
-- This should now work for all records

-- 1. Backfill cancel_audit_records
DO $$
DECLARE
  r RECORD;
  v_contact_id UUID;
  v_count INT := 0;
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
        NULL,
        r.insured_phone,
        r.insured_email
      );

      IF v_contact_id IS NOT NULL THEN
        UPDATE cancel_audit_records
        SET contact_id = v_contact_id
        WHERE id = r.id;
        v_count := v_count + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'cancel_audit_record % failed: %', r.id, SQLERRM;
    END;
  END LOOP;
  RAISE NOTICE 'cancel_audit_records: linked % records', v_count;
END $$;

-- 2. Backfill winback_households
DO $$
DECLARE
  r RECORD;
  v_contact_id UUID;
  v_count INT := 0;
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
        v_count := v_count + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'winback_household % failed: %', r.id, SQLERRM;
    END;
  END LOOP;
  RAISE NOTICE 'winback_households: linked % records', v_count;
END $$;

-- 3. Backfill renewal_records
DO $$
DECLARE
  r RECORD;
  v_contact_id UUID;
  v_count INT := 0;
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
        NULL,
        r.phone,
        r.email
      );

      IF v_contact_id IS NOT NULL THEN
        UPDATE renewal_records
        SET contact_id = v_contact_id
        WHERE id = r.id;
        v_count := v_count + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'renewal_record % failed: %', r.id, SQLERRM;
    END;
  END LOOP;
  RAISE NOTICE 'renewal_records: linked % records', v_count;
END $$;

-- 4. Backfill lqs_households
DO $$
DECLARE
  r RECORD;
  v_contact_id UUID;
  v_phone TEXT;
  v_count INT := 0;
BEGIN
  FOR r IN
    SELECT id, agency_id, first_name, last_name, zip_code, phone, email
    FROM lqs_households
    WHERE contact_id IS NULL
      AND last_name IS NOT NULL
      AND TRIM(last_name) != ''
  LOOP
    BEGIN
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
        v_count := v_count + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'lqs_household % failed: %', r.id, SQLERRM;
    END;
  END LOOP;
  RAISE NOTICE 'lqs_households: linked % records', v_count;
END $$;

-- Final report
DO $$
DECLARE
  v_cancel_null INT;
  v_winback_null INT;
  v_renewal_null INT;
  v_lqs_null INT;
BEGIN
  SELECT COUNT(*) INTO v_cancel_null FROM cancel_audit_records WHERE contact_id IS NULL AND insured_last_name IS NOT NULL AND TRIM(insured_last_name) != '';
  SELECT COUNT(*) INTO v_winback_null FROM winback_households WHERE contact_id IS NULL AND last_name IS NOT NULL AND TRIM(last_name) != '';
  SELECT COUNT(*) INTO v_renewal_null FROM renewal_records WHERE contact_id IS NULL AND last_name IS NOT NULL AND TRIM(last_name) != '';
  SELECT COUNT(*) INTO v_lqs_null FROM lqs_households WHERE contact_id IS NULL AND last_name IS NOT NULL AND TRIM(last_name) != '';

  RAISE NOTICE 'Remaining NULL contact_ids (with valid last_name):';
  RAISE NOTICE '  cancel_audit_records: %', v_cancel_null;
  RAISE NOTICE '  winback_households: %', v_winback_null;
  RAISE NOTICE '  renewal_records: %', v_renewal_null;
  RAISE NOTICE '  lqs_households: %', v_lqs_null;
END $$;
