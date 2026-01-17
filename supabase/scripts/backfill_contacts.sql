-- ============================================================
-- UNIFIED CONTACTS BACKFILL SCRIPT
-- ============================================================
-- Run this script in Supabase SQL Editor to populate the
-- agency_contacts table from existing data in:
--   - lqs_households
--   - cancel_audit_records
--   - renewal_records
--   - winback_households
--
-- This script is idempotent - safe to run multiple times.
-- ============================================================

-- ============================================================
-- STEP 1: Backfill from LQS Households (primary source)
-- ============================================================
DO $$
BEGIN
  RAISE NOTICE 'Step 1: Processing LQS households...';
END $$;

-- Insert contacts from lqs_households (has most complete data with household_key)
INSERT INTO agency_contacts (
  agency_id, first_name, last_name, household_key, zip_code, phones, emails
)
SELECT DISTINCT ON (agency_id, household_key)
  agency_id,
  UPPER(COALESCE(first_name, 'UNKNOWN')),
  UPPER(last_name),
  household_key,
  zip_code,
  COALESCE(phone, '{}'),
  CASE WHEN email IS NOT NULL AND TRIM(email) != '' THEN ARRAY[LOWER(TRIM(email))] ELSE '{}' END
FROM lqs_households
WHERE last_name IS NOT NULL
  AND TRIM(last_name) != ''
  AND household_key IS NOT NULL
ORDER BY agency_id, household_key, created_at DESC
ON CONFLICT (agency_id, household_key) DO NOTHING;

-- Link lqs_households records to their contacts
UPDATE lqs_households lh
SET contact_id = ac.id
FROM agency_contacts ac
WHERE lh.agency_id = ac.agency_id
  AND lh.household_key = ac.household_key
  AND lh.contact_id IS NULL;

-- ============================================================
-- STEP 2: Backfill from Cancel Audit Records
-- ============================================================
DO $$
BEGIN
  RAISE NOTICE 'Step 2: Processing Cancel Audit records...';
END $$;

-- Link by phone first (most reliable match)
UPDATE cancel_audit_records car
SET contact_id = ac.id
FROM agency_contacts ac
WHERE car.agency_id = ac.agency_id
  AND normalize_phone(car.insured_phone) IS NOT NULL
  AND normalize_phone(car.insured_phone) = ANY(ac.phones)
  AND car.contact_id IS NULL;

-- Create new contacts for unlinked records
INSERT INTO agency_contacts (
  agency_id, first_name, last_name, household_key, phones, emails
)
SELECT DISTINCT ON (agency_id, generated_key)
  agency_id,
  UPPER(COALESCE(insured_first_name, 'UNKNOWN')),
  UPPER(insured_last_name),
  generated_key,
  CASE WHEN normalize_phone(insured_phone) IS NOT NULL THEN ARRAY[normalize_phone(insured_phone)] ELSE '{}' END,
  CASE WHEN insured_email IS NOT NULL AND TRIM(insured_email) != '' THEN ARRAY[LOWER(TRIM(insured_email))] ELSE '{}' END
FROM (
  SELECT *, generate_household_key(insured_first_name, insured_last_name, NULL) as generated_key
  FROM cancel_audit_records
  WHERE contact_id IS NULL
    AND insured_last_name IS NOT NULL
    AND TRIM(insured_last_name) != ''
) sub
ORDER BY agency_id, generated_key, created_at DESC
ON CONFLICT (agency_id, household_key)
DO UPDATE SET
  phones = CASE
    WHEN normalize_phone(EXCLUDED.phones[1]) IS NOT NULL
      AND NOT normalize_phone(EXCLUDED.phones[1]) = ANY(agency_contacts.phones)
    THEN array_append(agency_contacts.phones, normalize_phone(EXCLUDED.phones[1]))
    ELSE agency_contacts.phones
  END,
  emails = CASE
    WHEN EXCLUDED.emails[1] IS NOT NULL
      AND NOT EXCLUDED.emails[1] = ANY(agency_contacts.emails)
    THEN array_append(agency_contacts.emails, EXCLUDED.emails[1])
    ELSE agency_contacts.emails
  END,
  updated_at = now();

-- Link remaining unlinked records
UPDATE cancel_audit_records car
SET contact_id = ac.id
FROM agency_contacts ac
WHERE car.agency_id = ac.agency_id
  AND car.contact_id IS NULL
  AND (
    (normalize_phone(car.insured_phone) IS NOT NULL AND normalize_phone(car.insured_phone) = ANY(ac.phones))
    OR
    (generate_household_key(car.insured_first_name, car.insured_last_name, NULL) = ac.household_key)
  );

-- ============================================================
-- STEP 3: Backfill from Renewal Records
-- ============================================================
DO $$
BEGIN
  RAISE NOTICE 'Step 3: Processing Renewal records...';
END $$;

-- Link by phone first
UPDATE renewal_records rr
SET contact_id = ac.id
FROM agency_contacts ac
WHERE rr.agency_id = ac.agency_id
  AND normalize_phone(rr.phone) IS NOT NULL
  AND normalize_phone(rr.phone) = ANY(ac.phones)
  AND rr.contact_id IS NULL;

-- Create new contacts for unlinked records
INSERT INTO agency_contacts (
  agency_id, first_name, last_name, household_key, phones, emails
)
SELECT DISTINCT ON (agency_id, generated_key)
  agency_id,
  UPPER(COALESCE(first_name, 'UNKNOWN')),
  UPPER(last_name),
  generated_key,
  CASE WHEN normalize_phone(phone) IS NOT NULL THEN ARRAY[normalize_phone(phone)] ELSE '{}' END,
  CASE WHEN email IS NOT NULL AND TRIM(email) != '' THEN ARRAY[LOWER(TRIM(email))] ELSE '{}' END
FROM (
  SELECT *, generate_household_key(first_name, last_name, NULL) as generated_key
  FROM renewal_records
  WHERE contact_id IS NULL
    AND last_name IS NOT NULL
    AND TRIM(last_name) != ''
) sub
ORDER BY agency_id, generated_key, created_at DESC
ON CONFLICT (agency_id, household_key)
DO UPDATE SET
  phones = CASE
    WHEN normalize_phone(EXCLUDED.phones[1]) IS NOT NULL
      AND NOT normalize_phone(EXCLUDED.phones[1]) = ANY(agency_contacts.phones)
    THEN array_append(agency_contacts.phones, normalize_phone(EXCLUDED.phones[1]))
    ELSE agency_contacts.phones
  END,
  emails = CASE
    WHEN EXCLUDED.emails[1] IS NOT NULL
      AND NOT EXCLUDED.emails[1] = ANY(agency_contacts.emails)
    THEN array_append(agency_contacts.emails, EXCLUDED.emails[1])
    ELSE agency_contacts.emails
  END,
  updated_at = now();

-- Link remaining by phone
UPDATE renewal_records rr
SET contact_id = ac.id
FROM agency_contacts ac
WHERE rr.agency_id = ac.agency_id
  AND rr.contact_id IS NULL
  AND normalize_phone(rr.phone) IS NOT NULL
  AND normalize_phone(rr.phone) = ANY(ac.phones);

-- Link remaining by household_key
UPDATE renewal_records rr
SET contact_id = ac.id
FROM agency_contacts ac
WHERE rr.agency_id = ac.agency_id
  AND rr.contact_id IS NULL
  AND generate_household_key(rr.first_name, rr.last_name, NULL) = ac.household_key;

-- ============================================================
-- STEP 4: Backfill from Winback Households
-- ============================================================
DO $$
BEGIN
  RAISE NOTICE 'Step 4: Processing Winback households...';
END $$;

-- Link by phone first
UPDATE winback_households wh
SET contact_id = ac.id
FROM agency_contacts ac
WHERE wh.agency_id = ac.agency_id
  AND normalize_phone(wh.phone) IS NOT NULL
  AND normalize_phone(wh.phone) = ANY(ac.phones)
  AND wh.contact_id IS NULL;

-- Create new contacts for unlinked records (winback has address data)
INSERT INTO agency_contacts (
  agency_id, first_name, last_name, household_key, zip_code,
  phones, emails, street_address, city, state
)
SELECT DISTINCT ON (agency_id, generated_key)
  agency_id,
  UPPER(COALESCE(first_name, 'UNKNOWN')),
  UPPER(last_name),
  generated_key,
  LEFT(zip_code, 5),
  CASE WHEN normalize_phone(phone) IS NOT NULL THEN ARRAY[normalize_phone(phone)] ELSE '{}' END,
  CASE WHEN email IS NOT NULL AND TRIM(email) != '' THEN ARRAY[LOWER(TRIM(email))] ELSE '{}' END,
  street_address,
  city,
  state
FROM (
  SELECT *, generate_household_key(first_name, last_name, zip_code) as generated_key
  FROM winback_households
  WHERE contact_id IS NULL
    AND last_name IS NOT NULL
    AND TRIM(last_name) != ''
) sub
ORDER BY agency_id, generated_key, created_at DESC
ON CONFLICT (agency_id, household_key)
DO UPDATE SET
  phones = CASE
    WHEN normalize_phone(EXCLUDED.phones[1]) IS NOT NULL
      AND NOT normalize_phone(EXCLUDED.phones[1]) = ANY(agency_contacts.phones)
    THEN array_append(agency_contacts.phones, normalize_phone(EXCLUDED.phones[1]))
    ELSE agency_contacts.phones
  END,
  emails = CASE
    WHEN EXCLUDED.emails[1] IS NOT NULL
      AND NOT EXCLUDED.emails[1] = ANY(agency_contacts.emails)
    THEN array_append(agency_contacts.emails, EXCLUDED.emails[1])
    ELSE agency_contacts.emails
  END,
  street_address = COALESCE(agency_contacts.street_address, EXCLUDED.street_address),
  city = COALESCE(agency_contacts.city, EXCLUDED.city),
  state = COALESCE(agency_contacts.state, EXCLUDED.state),
  zip_code = COALESCE(agency_contacts.zip_code, EXCLUDED.zip_code),
  updated_at = now();

-- Link remaining by phone
UPDATE winback_households wh
SET contact_id = ac.id
FROM agency_contacts ac
WHERE wh.agency_id = ac.agency_id
  AND wh.contact_id IS NULL
  AND normalize_phone(wh.phone) IS NOT NULL
  AND normalize_phone(wh.phone) = ANY(ac.phones);

-- Link remaining by household_key
UPDATE winback_households wh
SET contact_id = ac.id
FROM agency_contacts ac
WHERE wh.agency_id = ac.agency_id
  AND wh.contact_id IS NULL
  AND generate_household_key(wh.first_name, wh.last_name, wh.zip_code) = ac.household_key;

-- ============================================================
-- VERIFICATION: Check results
-- ============================================================
DO $$
BEGIN
  RAISE NOTICE 'Backfill complete! Running verification...';
END $$;

SELECT
  'Total Contacts Created' as metric,
  COUNT(*)::text as value
FROM agency_contacts
UNION ALL
SELECT 'LQS Linked', COUNT(*)::text FROM lqs_households WHERE contact_id IS NOT NULL
UNION ALL
SELECT 'LQS Total', COUNT(*)::text FROM lqs_households
UNION ALL
SELECT 'Cancel Audit Linked', COUNT(*)::text FROM cancel_audit_records WHERE contact_id IS NOT NULL
UNION ALL
SELECT 'Cancel Audit Total', COUNT(*)::text FROM cancel_audit_records
UNION ALL
SELECT 'Renewals Linked', COUNT(*)::text FROM renewal_records WHERE contact_id IS NOT NULL
UNION ALL
SELECT 'Renewals Total', COUNT(*)::text FROM renewal_records
UNION ALL
SELECT 'Winback Linked', COUNT(*)::text FROM winback_households WHERE contact_id IS NOT NULL
UNION ALL
SELECT 'Winback Total', COUNT(*)::text FROM winback_households;
