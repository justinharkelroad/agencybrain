-- Fix: drop the overly permissive service_role policy that applied to PUBLIC,
-- defeating agency isolation via has_agency_access.
-- Service role bypasses RLS anyway, so the policy was unnecessary.
DROP POLICY IF EXISTS "sp_assignments_service_role" ON sp_assignments;

-- Also add a staff self-read policy so staff users can see their own assignments
-- (the has_agency_access policies cover JWT users; staff users need service role
-- via edge functions, which already bypasses RLS, so no additional policy needed).
