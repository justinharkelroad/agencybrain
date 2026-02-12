-- Fix: handle_new_user() must include agency_email when creating an agency.
-- The NOT NULL constraint on agencies.agency_email (added in 20260206000000) is enforced,
-- but the trigger function in production is still the old version that omits agency_email,
-- causing "null value in column agency_email" errors on every new signup.

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

    -- Create agency if needed (agency_email is NOT NULL, use signup email)
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
