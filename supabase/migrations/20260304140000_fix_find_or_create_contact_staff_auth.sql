-- Fix find_or_create_contact to support staff session authentication.
-- Bug: Staff users clicking on a household name in LQS Roadmap get
-- "Failed to open contact profile" because the frontend called
-- agency_contacts directly (blocked by RLS since auth.uid() is null
-- for staff users). Now the frontend calls this RPC with a staff
-- session token, following the deny-by-default pattern.
-- Also adds p_link_household_id to set lqs_households.contact_id
-- inside the SECURITY DEFINER function (avoiding a second RLS-blocked call).

BEGIN;

-- Drop old signature (9 params) to avoid overload ambiguity
DROP FUNCTION IF EXISTS public.find_or_create_contact(uuid, text, text, text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.find_or_create_contact(
  p_agency_id uuid,
  p_first_name text,
  p_last_name text,
  p_zip_code text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_street_address text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_state text DEFAULT NULL,
  p_staff_session_token text DEFAULT NULL,
  p_link_household_id uuid DEFAULT NULL
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
  v_staff_member_id uuid;
BEGIN
  IF p_agency_id IS NULL THEN
    RAISE EXCEPTION 'agency_id is required';
  END IF;

  -- Deny-by-default auth: service_role, superuser, JWT, or staff session
  IF auth.role() = 'service_role' THEN
    NULL;  -- trusted edge function
  ELSIF current_user = 'postgres' OR
        (SELECT usesuper FROM pg_user WHERE usename = current_user) THEN
    NULL;  -- superuser / migration
  ELSIF auth.uid() IS NOT NULL THEN
    IF NOT has_agency_access(auth.uid(), p_agency_id) THEN
      RAISE EXCEPTION 'unauthorized' USING ERRCODE = '28000';
    END IF;
  ELSIF p_staff_session_token IS NOT NULL THEN
    v_staff_member_id := public.verify_staff_session(p_staff_session_token, p_agency_id);
    IF v_staff_member_id IS NULL THEN
      RAISE EXCEPTION 'unauthorized' USING ERRCODE = '28000';
    END IF;
  ELSE
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '28000';
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

      -- Link household if requested
      IF p_link_household_id IS NOT NULL THEN
        UPDATE lqs_households SET contact_id = v_contact_id WHERE id = p_link_household_id;
      END IF;

      RETURN v_contact_id;
    ELSIF v_phone_match_count > 1 THEN
      RAISE LOG 'find_or_create_contact: ambiguous phone match (% contacts for phone), falling back to household_key', v_phone_match_count;
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

    -- Link household if requested
    IF p_link_household_id IS NOT NULL THEN
      UPDATE lqs_households SET contact_id = v_contact_id WHERE id = p_link_household_id;
    END IF;

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

  -- Link household if requested
  IF p_link_household_id IS NOT NULL THEN
    UPDATE lqs_households SET contact_id = v_contact_id WHERE id = p_link_household_id;
  END IF;

  RETURN v_contact_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Permissions: allow anon (staff), authenticated (JWT), and service_role
REVOKE ALL ON FUNCTION public.find_or_create_contact(uuid, text, text, text, text, text, text, text, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_or_create_contact(uuid, text, text, text, text, text, text, text, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_or_create_contact(uuid, text, text, text, text, text, text, text, text, text, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.find_or_create_contact(uuid, text, text, text, text, text, text, text, text, text, uuid) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
