-- Update handle_new_user trigger to save full_name and email to profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id uuid;
  v_agency_name text;
  v_agency_slug text;
  v_full_name text;
  v_email text;
  v_membership_tier membership_tier;
BEGIN
  -- Extract data from metadata
  v_agency_name := new.raw_user_meta_data->>'agency_name';
  v_full_name := new.raw_user_meta_data->>'full_name';
  v_email := new.email;  -- Get email directly from auth.users
  
  -- Parse membership tier with default
  BEGIN
    v_membership_tier := COALESCE(
      (new.raw_user_meta_data->>'membership_tier')::membership_tier,
      '1:1 Coaching'::membership_tier
    );
  EXCEPTION WHEN OTHERS THEN
    v_membership_tier := '1:1 Coaching'::membership_tier;
  END;
  
  -- Only create agency if agency_name is provided
  IF v_agency_name IS NOT NULL AND v_agency_name != '' THEN
    -- Generate slug from agency name
    v_agency_slug := lower(regexp_replace(v_agency_name, '[^a-zA-Z0-9]+', '-', 'g'));
    v_agency_slug := trim(both '-' from v_agency_slug);
    
    -- Check if agency with this slug exists
    SELECT id INTO v_agency_id FROM agencies WHERE slug = v_agency_slug;
    
    -- If not exists, create the agency
    IF v_agency_id IS NULL THEN
      INSERT INTO agencies (name, slug)
      VALUES (v_agency_name, v_agency_slug)
      RETURNING id INTO v_agency_id;
      
      -- Create default scorecard rules for new agency
      PERFORM create_default_scorecard_rules(v_agency_id);
      
      -- Create default targets for new agency
      PERFORM create_default_targets(v_agency_id);
      
      -- Create default KPIs for new agency
      PERFORM create_default_kpis(v_agency_id);
    END IF;
  END IF;
  
  -- Insert profile with full_name and email
  INSERT INTO public.profiles (id, agency_id, membership_tier, full_name, email)
  VALUES (
    new.id,
    v_agency_id,
    v_membership_tier,
    v_full_name,
    v_email
  );
  
  RETURN new;
END;
$$;

-- Backfill existing users: copy email from auth.users to profiles
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id
AND p.email IS NULL;

-- Backfill full_name from auth.users raw_user_meta_data if available
UPDATE public.profiles p
SET full_name = u.raw_user_meta_data->>'full_name'
FROM auth.users u
WHERE p.id = u.id
AND p.full_name IS NULL
AND u.raw_user_meta_data->>'full_name' IS NOT NULL;