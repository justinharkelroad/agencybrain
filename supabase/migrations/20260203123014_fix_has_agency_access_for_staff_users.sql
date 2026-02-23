-- Fix has_agency_access to also check staff_users table via linked_profile_id
-- This allows staff users to access agency data through RLS policies
-- Staff users can be linked to a Supabase Auth profile via linked_profile_id

CREATE OR REPLACE FUNCTION public.has_agency_access(_user_id uuid, _agency_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := COALESCE(_user_id, auth.uid());
  v_has_access BOOLEAN := false;
BEGIN
  -- Check profiles table (agency owners, admins)
  IF to_regclass('public.profiles') IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = v_user_id
        AND (p.role = 'admin' OR p.agency_id = _agency_id)
    )
    INTO v_has_access;

    IF v_has_access THEN
      RETURN true;
    END IF;
  END IF;

  -- Check key_employees table
  IF to_regclass('public.key_employees') IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.key_employees ke
      WHERE ke.user_id = v_user_id
        AND ke.agency_id = _agency_id
    )
    INTO v_has_access;

    IF v_has_access THEN
      RETURN true;
    END IF;
  END IF;

  -- Check staff_users table via linked_profile_id (only when both table and column exist)
  IF
    to_regclass('public.staff_users') IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM pg_attribute
      WHERE attrelid = 'public.staff_users'::regclass
        AND attname = 'linked_profile_id'
        AND NOT attisdropped
    )
    AND EXISTS (
      SELECT 1
      FROM pg_attribute
      WHERE attrelid = 'public.staff_users'::regclass
        AND attname = 'agency_id'
        AND NOT attisdropped
    )
    AND EXISTS (
      SELECT 1
      FROM pg_attribute
      WHERE attrelid = 'public.staff_users'::regclass
        AND attname = 'is_active'
        AND NOT attisdropped
    )
  THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.staff_users su
      WHERE su.linked_profile_id = v_user_id
        AND su.agency_id = _agency_id
        AND su.is_active = true
    )
    INTO v_has_access;

    IF v_has_access THEN
      RETURN true;
    END IF;
  END IF;

  RETURN false;
END;
$$;

COMMENT ON FUNCTION public.has_agency_access(uuid, uuid) IS
  'Check if user has access to agency. Checks profiles (owners/admins), key_employees, and staff_users (via linked_profile_id).';
