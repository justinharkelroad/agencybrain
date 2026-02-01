-- Phase 0: Fix has_cancel_audit_access security vulnerability
-- CRITICAL: Remove user_metadata trust which allows any user to access any agency's data
--
-- Problem: Users can call supabase.auth.updateUser({ data: { staff_agency_id: 'any-uuid' } })
-- to gain access to any agency's data through RLS policies using has_cancel_audit_access().
--
-- Solution: Delegate to has_agency_access() which only trusts:
-- 1. profiles.agency_id (immutable by user)
-- 2. profiles.role = 'admin' (immutable by user)
-- 3. key_employees table (immutable by user)
--
-- Staff portal access is NOT affected because:
-- - Staff portal uses Edge Functions with SUPABASE_SERVICE_ROLE_KEY
-- - Service role bypasses RLS entirely
-- - Edge functions validate access via staff_sessions table

CREATE OR REPLACE FUNCTION has_cancel_audit_access(check_agency_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
AS $$
BEGIN
  -- Delegate to has_agency_access which handles:
  -- 1. profiles.agency_id check
  -- 2. profiles.role = 'admin' (cross-agency access)
  -- 3. key_employees table check
  --
  -- REMOVED: user_metadata.staff_agency_id trust (security vulnerability)
  RETURN has_agency_access(auth.uid(), check_agency_id);
END;
$$;

-- Add comment explaining the security fix
COMMENT ON FUNCTION has_cancel_audit_access IS
  'Checks if current user has access to agency data. Delegates to has_agency_access(). '
  'SECURITY FIX: No longer trusts user_metadata which users can modify. '
  'Staff portal access uses Edge Functions with service_role which bypasses RLS.';
