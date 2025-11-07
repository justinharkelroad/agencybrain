-- Restore agency auto-creation in handle_new_user trigger
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
BEGIN
  -- Extract agency_name from metadata
  v_agency_name := new.raw_user_meta_data->>'agency_name';
  
  -- If agency_name provided, create or find agency
  IF v_agency_name IS NOT NULL AND v_agency_name != '' THEN
    -- Generate slug from agency name
    v_agency_slug := lower(regexp_replace(v_agency_name, '[^a-zA-Z0-9]+', '-', 'g'));
    v_agency_slug := trim(both '-' from v_agency_slug);
    
    -- Check if agency with this name already exists
    SELECT id INTO v_agency_id
    FROM public.agencies
    WHERE name = v_agency_name OR slug = v_agency_slug
    LIMIT 1;
    
    -- Create agency if it doesn't exist
    IF v_agency_id IS NULL THEN
      INSERT INTO public.agencies (name, slug, description)
      VALUES (
        v_agency_name,
        v_agency_slug,
        'Agency created during user signup'
      )
      RETURNING id INTO v_agency_id;
      
      -- Setup default targets and scorecard rules for new agency
      PERFORM create_default_scorecard_rules(v_agency_id);
      PERFORM create_default_targets(v_agency_id);
    END IF;
  END IF;
  
  -- Insert profile with agency_id and membership_tier
  INSERT INTO public.profiles (id, agency_id, membership_tier)
  VALUES (
    new.id,
    v_agency_id,
    COALESCE(new.raw_user_meta_data->>'membership_tier', 'free')
  );
  
  RETURN new;
END;
$$;

-- Backfill existing users who have agency_name in metadata but no agency_id
DO $$
DECLARE
  v_user record;
  v_agency_id uuid;
  v_agency_name text;
  v_agency_slug text;
BEGIN
  FOR v_user IN 
    SELECT u.id, u.raw_user_meta_data
    FROM auth.users u
    JOIN public.profiles p ON p.id = u.id
    WHERE p.agency_id IS NULL
      AND u.raw_user_meta_data->>'agency_name' IS NOT NULL
      AND u.raw_user_meta_data->>'agency_name' != ''
  LOOP
    v_agency_name := v_user.raw_user_meta_data->>'agency_name';
    v_agency_slug := lower(regexp_replace(v_agency_name, '[^a-zA-Z0-9]+', '-', 'g'));
    v_agency_slug := trim(both '-' from v_agency_slug);
    
    -- Check if agency exists
    SELECT id INTO v_agency_id
    FROM public.agencies
    WHERE name = v_agency_name OR slug = v_agency_slug
    LIMIT 1;
    
    -- Create agency if needed
    IF v_agency_id IS NULL THEN
      INSERT INTO public.agencies (name, slug, description)
      VALUES (v_agency_name, v_agency_slug, 'Agency created during backfill')
      RETURNING id INTO v_agency_id;
      
      -- Setup defaults
      PERFORM create_default_scorecard_rules(v_agency_id);
      PERFORM create_default_targets(v_agency_id);
    END IF;
    
    -- Update profile
    UPDATE public.profiles
    SET agency_id = v_agency_id, updated_at = now()
    WHERE id = v_user.id;
    
    RAISE NOTICE 'Backfilled agency for user %: % (agency_id: %)', v_user.id, v_agency_name, v_agency_id;
  END LOOP;
END $$;