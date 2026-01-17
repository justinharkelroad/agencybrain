-- Phase 5: Create find_or_create_contact function
-- Finds existing contact by phone (primary) or household_key (secondary), or creates new

CREATE OR REPLACE FUNCTION public.find_or_create_contact(
  p_agency_id uuid,
  p_first_name text,
  p_last_name text,
  p_zip_code text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_street_address text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_state text DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_contact_id uuid;
  v_normalized_phone text;
  v_household_key text;
  v_clean_first text;
  v_clean_last text;
  v_clean_zip text;
  v_clean_email text;
BEGIN
  IF p_agency_id IS NULL THEN
    RAISE EXCEPTION 'agency_id is required';
  END IF;

  v_clean_first := UPPER(TRIM(COALESCE(p_first_name, '')));
  v_clean_last := UPPER(TRIM(COALESCE(p_last_name, '')));
  v_clean_zip := LEFT(TRIM(COALESCE(p_zip_code, '')), 5);
  v_normalized_phone := normalize_phone(p_phone);
  v_clean_email := LOWER(TRIM(COALESCE(p_email, '')));

  IF v_clean_last = '' THEN
    RAISE EXCEPTION 'last_name is required';
  END IF;

  v_household_key := generate_household_key(
    NULLIF(v_clean_first, ''),
    v_clean_last,
    NULLIF(v_clean_zip, '')
  );

  -- Primary match: phone
  IF v_normalized_phone IS NOT NULL THEN
    SELECT id INTO v_contact_id
    FROM agency_contacts
    WHERE agency_id = p_agency_id
      AND v_normalized_phone = ANY(phones)
    LIMIT 1;

    IF v_contact_id IS NOT NULL THEN
      UPDATE agency_contacts
      SET
        emails = CASE
          WHEN v_clean_email != '' AND NOT v_clean_email = ANY(emails)
          THEN array_append(emails, v_clean_email)
          ELSE emails
        END,
        street_address = COALESCE(NULLIF(p_street_address, ''), street_address),
        city = COALESCE(NULLIF(p_city, ''), city),
        state = COALESCE(NULLIF(p_state, ''), state),
        zip_code = COALESCE(NULLIF(v_clean_zip, ''), zip_code),
        updated_at = now()
      WHERE id = v_contact_id;

      RETURN v_contact_id;
    END IF;
  END IF;

  -- Secondary match: household_key
  SELECT id INTO v_contact_id
  FROM agency_contacts
  WHERE agency_id = p_agency_id
    AND household_key = v_household_key
  LIMIT 1;

  IF v_contact_id IS NOT NULL THEN
    UPDATE agency_contacts
    SET
      phones = CASE
        WHEN v_normalized_phone IS NOT NULL AND NOT v_normalized_phone = ANY(phones)
        THEN array_append(phones, v_normalized_phone)
        ELSE phones
      END,
      emails = CASE
        WHEN v_clean_email != '' AND NOT v_clean_email = ANY(emails)
        THEN array_append(emails, v_clean_email)
        ELSE emails
      END,
      street_address = COALESCE(NULLIF(p_street_address, ''), street_address),
      city = COALESCE(NULLIF(p_city, ''), city),
      state = COALESCE(NULLIF(p_state, ''), state),
      zip_code = COALESCE(NULLIF(v_clean_zip, ''), zip_code),
      updated_at = now()
    WHERE id = v_contact_id;

    RETURN v_contact_id;
  END IF;

  -- No match: create new
  INSERT INTO agency_contacts (
    agency_id, first_name, last_name, household_key, zip_code,
    phones, emails, street_address, city, state
  ) VALUES (
    p_agency_id,
    COALESCE(NULLIF(v_clean_first, ''), 'UNKNOWN'),
    v_clean_last,
    v_household_key,
    NULLIF(v_clean_zip, ''),
    CASE WHEN v_normalized_phone IS NOT NULL THEN ARRAY[v_normalized_phone] ELSE '{}' END,
    CASE WHEN v_clean_email != '' THEN ARRAY[v_clean_email] ELSE '{}' END,
    NULLIF(p_street_address, ''),
    NULLIF(p_city, ''),
    NULLIF(p_state, '')
  )
  RETURNING id INTO v_contact_id;

  RETURN v_contact_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION find_or_create_contact IS 'Finds existing contact by phone (primary) or household_key (secondary), or creates new. Returns contact UUID.';

-- Verification query (run after migration):
-- SELECT routine_name, routine_type
-- FROM information_schema.routines
-- WHERE routine_name = 'find_or_create_contact';
