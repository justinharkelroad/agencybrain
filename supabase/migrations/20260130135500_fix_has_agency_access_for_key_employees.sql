-- Fix has_agency_access to also check key_employees table
-- This allows key employees to access agency data through RLS policies
-- Previously, key employees were blocked because their agency_id is stored
-- in key_employees table, not in profiles table

CREATE OR REPLACE FUNCTION public.has_agency_access(_user_id uuid, _agency_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- Check profiles table (agency owners, admins)
    SELECT 1
    FROM public.profiles p
    WHERE p.id = COALESCE(_user_id, auth.uid())
      AND (p.role = 'admin' OR p.agency_id = _agency_id)
  )
  OR EXISTS (
    -- Check key_employees table
    SELECT 1
    FROM public.key_employees ke
    WHERE ke.user_id = COALESCE(_user_id, auth.uid())
      AND ke.agency_id = _agency_id
  );
$$;
