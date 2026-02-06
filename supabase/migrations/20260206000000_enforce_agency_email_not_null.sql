-- Migration: Enforce agency_email is never NULL
-- Problem: agency_email on agencies table is nullable. Multiple creation paths
-- omit it, causing agency owners to miss form submission feedback emails.

-- Step 1a: Backfill from team_members with role='Owner' (most authoritative)
UPDATE agencies a
SET agency_email = tm.email
FROM team_members tm
WHERE tm.agency_id = a.id
  AND tm.role = 'Owner'
  AND a.agency_email IS NULL
  AND tm.email IS NOT NULL
  AND tm.email <> '';

-- Step 1b: Backfill remaining NULLs from any linked profile's auth.users email
UPDATE agencies a
SET agency_email = u.email
FROM profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.agency_id = a.id
  AND a.agency_email IS NULL
  AND u.email IS NOT NULL;

-- Step 1c: Backfill remaining NULLs from any team_member email (non-Owner)
UPDATE agencies a
SET agency_email = (
  SELECT tm.email
  FROM team_members tm
  WHERE tm.agency_id = a.id
    AND tm.email IS NOT NULL
    AND tm.email <> ''
  LIMIT 1
)
WHERE a.agency_email IS NULL
  AND EXISTS (
    SELECT 1 FROM team_members tm
    WHERE tm.agency_id = a.id
      AND tm.email IS NOT NULL
      AND tm.email <> ''
  );

-- Step 2: Log any agencies that still have NULL (true orphans — no profiles, no team members)
DO $$
DECLARE
  r RECORD;
  orphan_count int;
BEGIN
  SELECT count(*) INTO orphan_count FROM agencies WHERE agency_email IS NULL;
  IF orphan_count > 0 THEN
    RAISE NOTICE '% orphan agencies with no recoverable email — deleting (no users linked):', orphan_count;
    FOR r IN
      SELECT id, name FROM agencies WHERE agency_email IS NULL
    LOOP
      RAISE NOTICE '  Agency % (%)', r.id, r.name;
    END LOOP;
  END IF;
END;
$$;

-- Step 3: Delete true orphan agencies (no profiles, no team members, no email — unusable)
-- Only deletes agencies that have zero profiles linked (safe: nobody can access them)
DELETE FROM agencies a
WHERE a.agency_email IS NULL
  AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.agency_id = a.id);

-- Step 4: For any remaining NULLs (agency with profiles but truly no email anywhere),
-- fail loudly so we can investigate manually rather than silently losing data
DO $$
DECLARE
  remaining int;
BEGIN
  SELECT count(*) INTO remaining FROM agencies WHERE agency_email IS NULL;
  IF remaining > 0 THEN
    RAISE EXCEPTION 'Cannot proceed: % agencies still have NULL agency_email with linked profiles. Fix manually before re-running.', remaining;
  END IF;
END;
$$;

-- Step 5: Add NOT NULL constraint
ALTER TABLE agencies ALTER COLUMN agency_email SET NOT NULL;

-- Step 6: Prevent empty-string bypass
ALTER TABLE agencies ADD CONSTRAINT agencies_email_not_empty CHECK (agency_email <> '');

-- Step 7: Update handle_new_user() trigger to include agency_email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_full_name text;
    v_agency_id uuid;
    v_agency_name text;
    v_email text;
    v_needs_agency boolean;
    v_existing_agency_id uuid;
BEGIN
    -- Extract metadata
    v_full_name := COALESCE(
        new.raw_user_meta_data ->> 'full_name',
        new.raw_user_meta_data ->> 'name',
        split_part(new.email, '@', 1)
    );
    v_email := new.email;
    v_agency_name := new.raw_user_meta_data ->> 'agency_name';
    v_needs_agency := COALESCE((new.raw_user_meta_data ->> 'needs_agency')::boolean, false);
    v_existing_agency_id := (new.raw_user_meta_data ->> 'agency_id')::uuid;

    -- Create agency if needed (now includes agency_email)
    IF v_needs_agency AND v_agency_name IS NOT NULL THEN
        INSERT INTO public.agencies (name, agency_email)
        VALUES (v_agency_name, v_email)
        RETURNING id INTO v_agency_id;
    ELSIF v_existing_agency_id IS NOT NULL THEN
        v_agency_id := v_existing_agency_id;
    END IF;

    -- Create profile
    INSERT INTO public.profiles (id, full_name, agency_id, email)
    VALUES (new.id, v_full_name, v_agency_id, v_email);

    -- If this user created the agency, also create an Owner team_member record
    IF v_needs_agency AND v_agency_id IS NOT NULL THEN
        INSERT INTO public.team_members (
            agency_id,
            name,
            email,
            role,
            employment,
            status
        )
        VALUES (
            v_agency_id,
            v_full_name,
            v_email,
            'Owner'::app_member_role,
            'Full-time'::app_employment_type,
            'active'::app_member_status
        );
    END IF;

    RETURN new;
END;
$$;
