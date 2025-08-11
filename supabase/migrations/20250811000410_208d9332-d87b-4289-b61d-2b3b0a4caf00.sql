
-- Update the trigger function to safely reuse or create the agency
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_agency_id uuid;
  v_agency_name text;
BEGIN
  -- Read agency name from user metadata
  v_agency_name := NEW.raw_user_meta_data ->> 'agency_name';

  IF v_agency_name IS NOT NULL AND length(trim(v_agency_name)) > 0 THEN
    -- Try to find an existing agency first
    SELECT id INTO v_agency_id
    FROM public.agencies
    WHERE name = v_agency_name;

    -- If not found, create or upsert one in a race-safe way
    IF v_agency_id IS NULL THEN
      INSERT INTO public.agencies (name)
      VALUES (v_agency_name)
      ON CONFLICT (name) DO UPDATE SET updated_at = now()
      RETURNING id INTO v_agency_id;
    END IF;
  END IF;

  -- Create the profile if not already present
  INSERT INTO public.profiles (id, agency_id, role)
  VALUES (
    NEW.id,
    v_agency_id,
    CASE WHEN NEW.email = 'admin@example.com' THEN 'admin' ELSE 'user' END
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$function$;
