-- Fix the sync_sale_to_lqs trigger to use LASTNAME_FIRSTNAME_ZIP format
-- This matches the format used by:
-- 1. Edge function create_staff_sale
-- 2. The generate_household_key() database function
-- Previous format was FIRSTNAME_LASTNAME which caused duplicate households

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
  v_name_parts TEXT[];
BEGIN
  -- Parse name: split into parts and use last part as last_name
  v_name_parts := string_to_array(TRIM(NEW.customer_name), ' ');

  IF array_length(v_name_parts, 1) >= 2 THEN
    -- Multiple parts: last element is last name, rest is first name
    v_last_name := UPPER(REGEXP_REPLACE(v_name_parts[array_length(v_name_parts, 1)], '[^A-Za-z]', '', 'g'));
    v_first_name := UPPER(REGEXP_REPLACE(array_to_string(v_name_parts[1:array_length(v_name_parts, 1)-1], ' '), '[^A-Za-z]', '', 'g'));
  ELSE
    -- Single part: use as both first and last
    v_first_name := UPPER(REGEXP_REPLACE(COALESCE(v_name_parts[1], 'UNKNOWN'), '[^A-Za-z]', '', 'g'));
    v_last_name := v_first_name;
  END IF;

  -- Handle empty names
  IF v_first_name = '' OR v_first_name IS NULL THEN
    v_first_name := 'UNKNOWN';
  END IF;
  IF v_last_name = '' OR v_last_name IS NULL THEN
    v_last_name := 'UNKNOWN';
  END IF;

  -- Generate household key: LASTNAME_FIRSTNAME_ZIP (matches generate_household_key function)
  v_household_key := v_last_name || '_' || v_first_name || '_' || COALESCE(LEFT(NEW.customer_zip, 5), '00000');

  -- Use existing contact_id if provided
  v_contact_id := NEW.contact_id;

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
         THEN REGEXP_REPLACE(NEW.customer_phone, '[^0-9]', '', 'g')
         ELSE NULL
    END,
    NULLIF(NEW.customer_email, ''),
    COALESCE(LEFT(NEW.customer_zip, 5), '00000'),
    v_household_key,
    'sold',
    v_contact_id,
    NEW.lead_source_id,
    NEW.sale_date,
    NEW.sale_date,
    now()
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

-- Also fix existing bad records created with wrong format (lowercase firstname_lastname)
-- Convert them to correct format (uppercase LASTNAME_FIRSTNAME)
-- This is a best-effort fix - records with conflicts will be skipped

-- First, identify and fix records where household_key doesn't match the standard format
DO $$
DECLARE
  r RECORD;
  v_new_key TEXT;
BEGIN
  FOR r IN
    SELECT id, agency_id, first_name, last_name, zip_code, household_key
    FROM lqs_households
    WHERE household_key ~ '^[a-z]'  -- Starts with lowercase (wrong format)
       OR household_key !~ '^[A-Z]+_[A-Z]+_[0-9]'  -- Doesn't match LASTNAME_FIRSTNAME_ZIP pattern
  LOOP
    -- Generate correct key
    v_new_key := UPPER(REGEXP_REPLACE(COALESCE(r.last_name, 'UNKNOWN'), '[^A-Za-z]', '', 'g')) || '_' ||
                 UPPER(REGEXP_REPLACE(COALESCE(r.first_name, 'UNKNOWN'), '[^A-Za-z]', '', 'g')) || '_' ||
                 COALESCE(LEFT(r.zip_code, 5), '00000');

    -- Only update if new key doesn't conflict
    UPDATE lqs_households
    SET household_key = v_new_key,
        first_name = UPPER(REGEXP_REPLACE(COALESCE(first_name, 'UNKNOWN'), '[^A-Za-z]', '', 'g')),
        last_name = UPPER(REGEXP_REPLACE(COALESCE(last_name, 'UNKNOWN'), '[^A-Za-z]', '', 'g')),
        updated_at = now()
    WHERE id = r.id
      AND NOT EXISTS (
        SELECT 1 FROM lqs_households h2
        WHERE h2.agency_id = r.agency_id
          AND h2.household_key = v_new_key
          AND h2.id != r.id
      );
  END LOOP;
END $$;
