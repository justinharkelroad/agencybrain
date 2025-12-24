-- Step 1: Add new Call Scoring tiers to the enum
ALTER TYPE membership_tier ADD VALUE IF NOT EXISTS 'Call Scoring 30';
ALTER TYPE membership_tier ADD VALUE IF NOT EXISTS 'Call Scoring 50';
ALTER TYPE membership_tier ADD VALUE IF NOT EXISTS 'Call Scoring 100';

-- Step 2: Allow NULL in membership_tier column (drop NOT NULL constraint)
ALTER TABLE profiles ALTER COLUMN membership_tier DROP NOT NULL;

-- Step 3: Remove column default from profiles.membership_tier
ALTER TABLE profiles ALTER COLUMN membership_tier DROP DEFAULT;

-- Step 4: Update handle_new_user trigger to set NULL instead of defaulting to '1:1 Coaching'
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  
  -- Parse membership tier - set NULL if not provided (pending activation)
  IF new.raw_user_meta_data->>'membership_tier' IS NOT NULL 
     AND new.raw_user_meta_data->>'membership_tier' != '' THEN
    BEGIN
      v_membership_tier := (new.raw_user_meta_data->>'membership_tier')::membership_tier;
    EXCEPTION WHEN OTHERS THEN
      v_membership_tier := NULL;  -- Invalid tier = pending activation
    END;
  ELSE
    v_membership_tier := NULL;  -- No tier provided = pending activation
  END IF;
  
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
$function$;

-- Step 5: Fix the test account to have NULL tier for testing
UPDATE profiles SET membership_tier = NULL WHERE email = 'justinhark123@aol.com';