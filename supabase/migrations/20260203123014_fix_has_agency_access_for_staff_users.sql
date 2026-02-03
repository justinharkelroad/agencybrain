-- Fix has_agency_access to also check staff_users table via linked_profile_id
-- This allows staff users to access agency data through RLS policies
-- Staff users can be linked to a Supabase Auth profile via linked_profile_id

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
  )
  OR EXISTS (
    -- Check staff_users table via linked_profile_id
    -- Staff users linked to a Supabase Auth profile can access their agency
    SELECT 1
    FROM public.staff_users su
    WHERE su.linked_profile_id = COALESCE(_user_id, auth.uid())
      AND su.agency_id = _agency_id
      AND su.is_active = true
  );
$$;

COMMENT ON FUNCTION public.has_agency_access(uuid, uuid) IS
  'Check if user has access to agency. Checks profiles (owners/admins), key_employees, and staff_users (via linked_profile_id).';
