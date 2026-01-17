-- Phase 7: Backfill from lqs_households
-- Populates agency_contacts from LQS data and links records

-- Insert contacts from lqs_households (primary source with most complete data)
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

-- Verification query (run after migration):
-- SELECT
--   COUNT(*) as total_lqs,
--   COUNT(contact_id) as linked,
--   ROUND(100.0 * COUNT(contact_id) / NULLIF(COUNT(*), 0), 1) as pct
-- FROM lqs_households;
