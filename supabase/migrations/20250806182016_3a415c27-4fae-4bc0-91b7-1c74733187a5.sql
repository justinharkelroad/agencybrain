-- Fix the remaining function security warning by updating handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  agency_id_var UUID;
BEGIN
  -- Create agency if agency_name is provided
  IF NEW.raw_user_meta_data ->> 'agency_name' IS NOT NULL THEN
    INSERT INTO public.agencies (name)
    VALUES (NEW.raw_user_meta_data ->> 'agency_name')
    RETURNING id INTO agency_id_var;
  END IF;

  -- Create profile for the new user
  INSERT INTO public.profiles (id, agency_id, role)
  VALUES (
    NEW.id, 
    agency_id_var,
    CASE WHEN NEW.email = 'admin@example.com' THEN 'admin' ELSE 'user' END
  );
  
  RETURN NEW;
END;
$function$;