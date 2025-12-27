CREATE OR REPLACE FUNCTION has_cancel_audit_access(check_agency_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
AS $$
DECLARE
  v_user_id UUID;
  v_jwt_agency_id UUID;
  v_profile_agency_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check for staff portal session from JWT metadata (no table query needed)
  v_jwt_agency_id := (auth.jwt() -> 'user_metadata' ->> 'staff_agency_id')::UUID;
  
  IF v_jwt_agency_id IS NOT NULL THEN
    RETURN v_jwt_agency_id = check_agency_id;
  END IF;
  
  -- Otherwise check regular profile
  SELECT agency_id INTO v_profile_agency_id
  FROM profiles
  WHERE id = v_user_id;
  
  RETURN v_profile_agency_id = check_agency_id;
END;
$$;