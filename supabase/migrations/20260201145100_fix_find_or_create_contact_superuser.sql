-- Fix find_or_create_contact to allow superuser access (for migrations and backfills)
-- Also allow when running as the db owner (postgres)

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
  v_phone_match_count int;
BEGIN
  IF p_agency_id IS NULL THEN
    RAISE EXCEPTION 'agency_id is required';
  END IF;

  -- Access check:
  -- 1. Service role bypasses (edge functions)
  -- 2. Superuser bypasses (migrations, backfills)
  -- 3. Otherwise check has_agency_access
  IF auth.role() = 'service_role' THEN
    -- Service role is trusted - edge functions already validate access via session tables
    NULL;
  ELSIF current_user = 'postgres' OR
        (SELECT usesuper FROM pg_user WHERE usename = current_user) THEN
    -- Superuser/postgres bypasses - for migrations and admin operations
    NULL;
  ELSIF NOT has_agency_access(auth.uid(), p_agency_id) THEN
    RAISE EXCEPTION 'Access denied: user does not have permission for agency %', p_agency_id;
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

  -- Primary match: phone (AMBIGUITY-SAFE: count first to detect multiple matches)
  IF v_normalized_phone IS NOT NULL THEN
    SELECT COUNT(*) INTO v_phone_match_count
    FROM agency_contacts
    WHERE agency_id = p_agency_id
      AND v_normalized_phone = ANY(phones);

    IF v_phone_match_count = 1 THEN
      -- Exactly one match, safe to use
      SELECT id INTO v_contact_id
      FROM agency_contacts
      WHERE agency_id = p_agency_id
        AND v_normalized_phone = ANY(phones);

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
    ELSIF v_phone_match_count > 1 THEN
      -- Ambiguous: multiple contacts share this phone, fall through to household_key
      RAISE LOG 'find_or_create_contact: ambiguous phone match (% contacts for phone), falling back to household_key', v_phone_match_count;
    END IF;
    -- v_phone_match_count = 0: no match, continue to household_key
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

  -- No match: create new (with ON CONFLICT for race condition safety)
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
  ON CONFLICT (agency_id, household_key) DO UPDATE SET
    -- On conflict, merge in new phone/email and update timestamp
    phones = CASE
      WHEN v_normalized_phone IS NOT NULL AND NOT v_normalized_phone = ANY(agency_contacts.phones)
      THEN array_append(agency_contacts.phones, v_normalized_phone)
      ELSE agency_contacts.phones
    END,
    emails = CASE
      WHEN v_clean_email != '' AND NOT v_clean_email = ANY(agency_contacts.emails)
      THEN array_append(agency_contacts.emails, v_clean_email)
      ELSE agency_contacts.emails
    END,
    street_address = COALESCE(NULLIF(p_street_address, ''), agency_contacts.street_address),
    city = COALESCE(NULLIF(p_city, ''), agency_contacts.city),
    state = COALESCE(NULLIF(p_state, ''), agency_contacts.state),
    zip_code = COALESCE(NULLIF(v_clean_zip, ''), agency_contacts.zip_code),
    updated_at = now()
  RETURNING id INTO v_contact_id;

  RETURN v_contact_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
