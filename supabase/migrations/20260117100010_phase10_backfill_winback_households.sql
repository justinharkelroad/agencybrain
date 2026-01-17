-- Phase 10: Backfill from winback_households
-- Links winback records to contacts by phone, then creates new contacts for unmatched

-- IMPORTANT: If this migration times out, run these statements separately:
-- 1. First UPDATE (link by phone)
-- 2. INSERT statement (create contacts)
-- 3. Second UPDATE (link by phone)
-- 4. Third UPDATE (link by household_key)

-- Link by phone first (most reliable match)
UPDATE winback_households wh
SET contact_id = ac.id
FROM agency_contacts ac
WHERE wh.agency_id = ac.agency_id
  AND normalize_phone(wh.phone) IS NOT NULL
  AND normalize_phone(wh.phone) = ANY(ac.phones)
  AND wh.contact_id IS NULL;

-- Create new contacts for unlinked records (winback has most complete address data)
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

-- Verification query (run after migration):
-- SELECT
--   COUNT(*) as total_winback,
--   COUNT(contact_id) as linked,
--   ROUND(100.0 * COUNT(contact_id) / NULLIF(COUNT(*), 0), 1) as pct
-- FROM winback_households;

-- Final verification query (run after all migrations):
-- SELECT
--   'agency_contacts' as metric,
--   COUNT(*) as value
-- FROM agency_contacts
-- UNION ALL
-- SELECT 'contacts_with_phone', COUNT(*) FROM agency_contacts WHERE array_length(phones, 1) > 0
-- UNION ALL
-- SELECT 'contacts_multi_phone', COUNT(*) FROM agency_contacts WHERE array_length(phones, 1) > 1
-- UNION ALL
-- SELECT 'lqs_linked', COUNT(*) FROM lqs_households WHERE contact_id IS NOT NULL
-- UNION ALL
-- SELECT 'cancel_linked', COUNT(*) FROM cancel_audit_records WHERE contact_id IS NOT NULL
-- UNION ALL
-- SELECT 'renewal_linked', COUNT(*) FROM renewal_records WHERE contact_id IS NOT NULL
-- UNION ALL
-- SELECT 'winback_linked', COUNT(*) FROM winback_households WHERE contact_id IS NOT NULL;
