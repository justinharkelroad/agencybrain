-- Phase 8: Backfill from cancel_audit_records
-- Links cancel audit records to contacts by phone, then creates new contacts for unmatched

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

-- Verification query (run after migration):
-- SELECT
--   COUNT(*) as total_cancel,
--   COUNT(contact_id) as linked,
--   ROUND(100.0 * COUNT(contact_id) / NULLIF(COUNT(*), 0), 1) as pct
-- FROM cancel_audit_records;
