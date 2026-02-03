-- Fix has_sales_experience_access function to use correct role detection logic
--
-- The original function checked profile.role for 'agency_owner' and 'key_employee',
-- but these values are never set in the database. Instead:
-- - Agency owners are identified by having a non-null agency_id in profiles
-- - Key employees are identified by existing in the key_employees table
-- - Only 'admin' is stored in the role field

CREATE OR REPLACE FUNCTION public.has_sales_experience_access(
  p_user_id uuid,
  p_agency_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_profile record;
  v_agency_id uuid;
  v_is_admin boolean;
  v_is_agency_owner boolean;
  v_is_key_employee boolean;
  v_key_employee_agency_id uuid;
BEGIN
  -- Get user's profile and agency
  SELECT id, agency_id, role INTO v_profile
  FROM public.profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Check if user is admin (by role field)
  v_is_admin := (v_profile.role = 'admin');

  -- Check if user is agency owner (by having agency_id)
  v_is_agency_owner := (v_profile.agency_id IS NOT NULL);

  -- Check if user is key employee (by existing in key_employees table)
  SELECT agency_id INTO v_key_employee_agency_id
  FROM public.key_employees
  WHERE user_id = p_user_id;

  v_is_key_employee := (v_key_employee_agency_id IS NOT NULL);

  -- Must be admin, agency owner, or key employee
  IF NOT v_is_admin AND NOT v_is_agency_owner AND NOT v_is_key_employee THEN
    RETURN false;
  END IF;

  -- Use provided agency_id, or fall back to profile agency_id, or key employee's agency
  v_agency_id := COALESCE(p_agency_id, v_profile.agency_id, v_key_employee_agency_id);

  IF v_agency_id IS NULL THEN
    RETURN false;
  END IF;

  -- Check if agency has an active/pending assignment
  RETURN EXISTS (
    SELECT 1 FROM public.sales_experience_assignments
    WHERE agency_id = v_agency_id
      AND status IN ('pending', 'active')
  );
END;
$$;

COMMENT ON FUNCTION public.has_sales_experience_access IS
'Check if user has access to sales experience feature. Returns true if:
1. User is admin, agency owner (has agency_id), or key employee (in key_employees table)
2. The agency has an active or pending sales experience assignment';
