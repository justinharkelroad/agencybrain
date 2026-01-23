-- Create contacts from sales for agencies that have sales but no contacts
-- This handles agencies like Josh's that only have sales data

INSERT INTO agency_contacts (
  agency_id,
  first_name,
  last_name,
  phones,
  emails,
  zip_code,
  household_key
)
SELECT DISTINCT ON (s.agency_id, generated_key)
  s.agency_id,
  UPPER(TRIM(SPLIT_PART(s.customer_name, ' ', 1))) as first_name,
  UPPER(TRIM(
    CASE 
      WHEN POSITION(' ' IN s.customer_name) > 0 
      THEN SUBSTRING(s.customer_name FROM POSITION(' ' IN s.customer_name) + 1)
      ELSE ''
    END
  )) as last_name,
  CASE WHEN s.customer_phone IS NOT NULL AND s.customer_phone != '' 
       THEN ARRAY[REGEXP_REPLACE(s.customer_phone, '[^0-9]', '', 'g')]
       ELSE ARRAY[]::text[] 
  END as phones,
  CASE WHEN s.customer_email IS NOT NULL AND s.customer_email != '' 
       THEN ARRAY[LOWER(s.customer_email)]
       ELSE ARRAY[]::text[] 
  END as emails,
  s.customer_zip as zip_code,
  UPPER(TRIM(SPLIT_PART(s.customer_name, ' ', 1))) || '_' || 
  UPPER(TRIM(
    CASE 
      WHEN POSITION(' ' IN TRIM(s.customer_name)) > 0 
      THEN SPLIT_PART(TRIM(s.customer_name), ' ', 2)
      ELSE ''
    END
  )) || '_' || COALESCE(s.customer_zip, '') as generated_key
FROM sales s
LEFT JOIN agency_contacts ac ON ac.agency_id = s.agency_id 
  AND ac.household_key = UPPER(TRIM(SPLIT_PART(s.customer_name, ' ', 1))) || '_' || 
      UPPER(TRIM(
        CASE 
          WHEN POSITION(' ' IN TRIM(s.customer_name)) > 0 
          THEN SPLIT_PART(TRIM(s.customer_name), ' ', 2)
          ELSE ''
        END
      )) || '_' || COALESCE(s.customer_zip, '')
WHERE s.agency_id = '16889dfb-b836-467d-986d-fcc3f0390eb3'
  AND ac.id IS NULL
  AND s.customer_name IS NOT NULL
  AND s.customer_name != ''
ON CONFLICT (agency_id, household_key) DO NOTHING;