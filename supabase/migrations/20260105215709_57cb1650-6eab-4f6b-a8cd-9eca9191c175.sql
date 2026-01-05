-- Step 2a: Update existing team_members who are actually agency owners to have 'Owner' role
-- (where the team_member email matches the profile email of the first agency profile)
UPDATE team_members tm
SET role = 'Owner'::app_member_role
FROM profiles p
WHERE tm.agency_id = p.agency_id
  AND tm.email = p.email
  AND tm.role != 'Owner'
  AND p.id = (
    SELECT p2.id 
    FROM profiles p2 
    WHERE p2.agency_id = p.agency_id
    ORDER BY p2.created_at ASC
    LIMIT 1
  );

-- Step 2b: Backfill agency owners who don't have a team_member at all (no email match)
INSERT INTO team_members (agency_id, name, email, role, employment, status)
SELECT 
  p.agency_id,
  COALESCE(p.full_name, 'Agency Owner'),
  p.email,
  'Owner'::app_member_role,
  'Full-time'::app_employment_type,
  'active'::app_member_status
FROM profiles p
WHERE p.agency_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM team_members tm 
    WHERE tm.agency_id = p.agency_id 
    AND tm.role = 'Owner'
  )
  AND NOT EXISTS (
    SELECT 1 FROM team_members tm 
    WHERE tm.agency_id = p.agency_id 
    AND tm.email = p.email
  )
  AND p.id = (
    SELECT p2.id 
    FROM profiles p2 
    WHERE p2.agency_id = p.agency_id
    ORDER BY p2.created_at ASC
    LIMIT 1
  );

-- Step 3: Fix existing unassigned sales by assigning them to the agency owner
UPDATE sales s
SET team_member_id = (
  SELECT tm.id 
  FROM team_members tm 
  WHERE tm.agency_id = s.agency_id 
  AND tm.role = 'Owner'
  LIMIT 1
)
WHERE s.team_member_id IS NULL
  AND EXISTS (
    SELECT 1 FROM team_members tm 
    WHERE tm.agency_id = s.agency_id 
    AND tm.role = 'Owner'
  );

-- Step 4: Update handle_new_user() function to auto-create Owner team_member on signup
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

    -- Create agency if needed
    IF v_needs_agency AND v_agency_name IS NOT NULL THEN
        INSERT INTO public.agencies (name)
        VALUES (v_agency_name)
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
            COALESCE(v_full_name, 'Agency Owner'),
            v_email,
            'Owner'::app_member_role,
            'Full-time'::app_employment_type,
            'active'::app_member_status
        );
    END IF;

    RETURN new;
END;
$$;