-- Backfill lqs_households from sales that don't have corresponding LQS records
-- And create a trigger to ensure future sales always create LQS records

-- Step 1: Backfill existing sales to lqs_households
INSERT INTO lqs_households (
  agency_id,
  team_member_id,
  first_name,
  last_name,
  phone,
  email,
  zip_code,
  household_key,
  status,
  contact_id,
  lead_source_id,
  first_quote_date,
  sold_date,
  created_at
)
SELECT 
  s.agency_id,
  s.team_member_id,
  UPPER(TRIM(SPLIT_PART(s.customer_name, ' ', 1))) as first_name,
  UPPER(TRIM(
    CASE 
      WHEN POSITION(' ' IN TRIM(s.customer_name)) > 0 
      THEN SUBSTRING(s.customer_name FROM POSITION(' ' IN s.customer_name) + 1)
      ELSE ''
    END
  )) as last_name,
  CASE WHEN s.customer_phone IS NOT NULL AND s.customer_phone != '' 
       THEN ARRAY[REGEXP_REPLACE(s.customer_phone, '[^0-9]', '', 'g')]
       ELSE ARRAY[]::text[] 
  END as phone,
  LOWER(s.customer_email) as email,
  s.customer_zip as zip_code,
  UPPER(TRIM(SPLIT_PART(s.customer_name, ' ', 1))) || '_' || 
    UPPER(TRIM(
      CASE 
        WHEN POSITION(' ' IN TRIM(s.customer_name)) > 0 
        THEN SPLIT_PART(TRIM(s.customer_name), ' ', 2)
        ELSE ''
      END
    )) || '_' || COALESCE(s.customer_zip, '') as household_key,
  'sold' as status,
  s.contact_id,
  s.lead_source_id,
  s.sale_date as first_quote_date,
  s.sale_date as sold_date,
  s.created_at
FROM sales s
WHERE NOT EXISTS (
  SELECT 1 FROM lqs_households lqs 
  WHERE lqs.agency_id = s.agency_id 
  AND lqs.contact_id = s.contact_id
)
AND s.contact_id IS NOT NULL
ON CONFLICT (agency_id, household_key) 
DO UPDATE SET 
  status = 'sold',
  sold_date = EXCLUDED.sold_date,
  contact_id = COALESCE(lqs_households.contact_id, EXCLUDED.contact_id),
  team_member_id = COALESCE(lqs_households.team_member_id, EXCLUDED.team_member_id);

-- Step 2: Create trigger function to auto-create LQS records from sales
CREATE OR REPLACE FUNCTION public.sync_sale_to_lqs()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_first_name TEXT;
  v_last_name TEXT;
  v_household_key TEXT;
  v_contact_id UUID;
BEGIN
  -- Parse name
  v_first_name := UPPER(TRIM(SPLIT_PART(NEW.customer_name, ' ', 1)));
  v_last_name := UPPER(TRIM(
    CASE 
      WHEN POSITION(' ' IN TRIM(NEW.customer_name)) > 0 
      THEN SUBSTRING(NEW.customer_name FROM POSITION(' ' IN NEW.customer_name) + 1)
      ELSE ''
    END
  ));
  v_household_key := v_first_name || '_' || 
    UPPER(TRIM(
      CASE 
        WHEN POSITION(' ' IN TRIM(NEW.customer_name)) > 0 
        THEN SPLIT_PART(TRIM(NEW.customer_name), ' ', 2)
        ELSE ''
      END
    )) || '_' || COALESCE(NEW.customer_zip, '');

  -- Ensure contact exists
  IF NEW.contact_id IS NULL THEN
    -- Try to find existing contact
    SELECT id INTO v_contact_id
    FROM agency_contacts
    WHERE agency_id = NEW.agency_id
      AND household_key = v_household_key
    LIMIT 1;
    
    -- Create contact if not found
    IF v_contact_id IS NULL THEN
      INSERT INTO agency_contacts (
        agency_id, first_name, last_name, phones, emails, zip_code, household_key
      ) VALUES (
        NEW.agency_id,
        v_first_name,
        v_last_name,
        CASE WHEN NEW.customer_phone IS NOT NULL AND NEW.customer_phone != '' 
             THEN ARRAY[REGEXP_REPLACE(NEW.customer_phone, '[^0-9]', '', 'g')]
             ELSE ARRAY[]::text[] 
        END,
        CASE WHEN NEW.customer_email IS NOT NULL AND NEW.customer_email != '' 
             THEN ARRAY[LOWER(NEW.customer_email)]
             ELSE ARRAY[]::text[] 
        END,
        NEW.customer_zip,
        v_household_key
      )
      ON CONFLICT (agency_id, household_key) DO UPDATE SET updated_at = now()
      RETURNING id INTO v_contact_id;
    END IF;
    
    -- Update the sale with the contact_id
    NEW.contact_id := v_contact_id;
  ELSE
    v_contact_id := NEW.contact_id;
  END IF;

  -- Upsert LQS household with status='sold'
  INSERT INTO lqs_households (
    agency_id,
    team_member_id,
    first_name,
    last_name,
    phone,
    email,
    zip_code,
    household_key,
    status,
    contact_id,
    lead_source_id,
    first_quote_date,
    sold_date,
    created_at
  ) VALUES (
    NEW.agency_id,
    NEW.team_member_id,
    v_first_name,
    v_last_name,
    CASE WHEN NEW.customer_phone IS NOT NULL AND NEW.customer_phone != '' 
         THEN ARRAY[REGEXP_REPLACE(NEW.customer_phone, '[^0-9]', '', 'g')]
         ELSE ARRAY[]::text[] 
    END,
    LOWER(NEW.customer_email),
    NEW.customer_zip,
    v_household_key,
    'sold',
    v_contact_id,
    NEW.lead_source_id,
    NEW.sale_date,
    NEW.sale_date,
    NEW.created_at
  )
  ON CONFLICT (agency_id, household_key) 
  DO UPDATE SET 
    status = 'sold',
    sold_date = EXCLUDED.sold_date,
    contact_id = COALESCE(lqs_households.contact_id, EXCLUDED.contact_id),
    team_member_id = COALESCE(lqs_households.team_member_id, EXCLUDED.team_member_id),
    lead_source_id = COALESCE(lqs_households.lead_source_id, EXCLUDED.lead_source_id),
    updated_at = now();

  RETURN NEW;
END;
$$;

-- Step 3: Create trigger on sales table
DROP TRIGGER IF EXISTS sync_sale_to_lqs_trigger ON sales;
CREATE TRIGGER sync_sale_to_lqs_trigger
  BEFORE INSERT ON sales
  FOR EACH ROW
  EXECUTE FUNCTION sync_sale_to_lqs();