-- Phase 9: Backfill from renewal_records
-- Links renewal records to contacts by phone, then creates new contacts for unmatched

-- Link by phone first (most reliable match)
UPDATE renewal_records rr
SET contact_id = ac.id
FROM agency_contacts ac
WHERE rr.agency_id = ac.agency_id
  AND normalize_phone(rr.phone) IS NOT NULL
  AND normalize_phone(rr.phone) = ANY(ac.phones)
  AND rr.contact_id IS NULL;

-- Create new contacts for unlinked records
INSERT INTO agency_contacts (
  agency_id, first_name, last_name, household_key, zip_code, phones, emails
)
SELECT DISTINCT ON (agency_id, generated_key)
  agency_id,
  UPPER(COALESCE(first_name, 'UNKNOWN')),
  UPPER(last_name),
  generated_key,
  LEFT(zip_code, 5),
  CASE WHEN normalize_phone(phone) IS NOT NULL THEN ARRAY[normalize_phone(phone)] ELSE '{}' END,
  CASE WHEN email IS NOT NULL AND TRIM(email) != '' THEN ARRAY[LOWER(TRIM(email))] ELSE '{}' END
FROM (
  SELECT *, generate_household_key(first_name, last_name, zip_code) as generated_key
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
  zip_code = COALESCE(agency_contacts.zip_code, EXCLUDED.zip_code),
  updated_at = now();

-- Link remaining unlinked records
UPDATE renewal_records rr
SET contact_id = ac.id
FROM agency_contacts ac
WHERE rr.agency_id = ac.agency_id
  AND rr.contact_id IS NULL
  AND (
    (normalize_phone(rr.phone) IS NOT NULL AND normalize_phone(rr.phone) = ANY(ac.phones))
    OR
    (generate_household_key(rr.first_name, rr.last_name, rr.zip_code) = ac.household_key)
  );

-- Verification query (run after migration):
-- SELECT
--   COUNT(*) as total_renewal,
--   COUNT(contact_id) as linked,
--   ROUND(100.0 * COUNT(contact_id) / NULLIF(COUNT(*), 0), 1) as pct
-- FROM renewal_records;
