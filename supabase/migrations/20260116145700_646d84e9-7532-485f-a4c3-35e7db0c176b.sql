-- Fix the handle_new_user trigger to NEVER use 'Agency Owner' as placeholder
-- Use email prefix which is unique per user

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
    -- Extract metadata - prioritize actual name, fall back to email prefix (NEVER 'Agency Owner')
    v_full_name := COALESCE(
        new.raw_user_meta_data ->> 'full_name',
        new.raw_user_meta_data ->> 'name',
        split_part(new.email, '@', 1)  -- Email prefix is unique per user
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
            v_full_name,  -- Use actual name or email prefix, never 'Agency Owner'
            v_email,
            'Owner'::app_member_role,
            'Full-time'::app_employment_type,
            'active'::app_member_status
        );
    END IF;

    RETURN new;
END;
$$;

-- Update existing team_members named "Agency Owner" to use their email prefix
-- This makes the UI clearer and prevents username collisions
UPDATE team_members tm
SET name = split_part(tm.email, '@', 1)
WHERE tm.name = 'Agency Owner'
  AND tm.email IS NOT NULL;