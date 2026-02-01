-- CRITICAL SECURITY FIX: Revoke column-level UPDATE/INSERT on sensitive profile fields
--
-- Problem: authenticated (and anon) have UPDATE privilege on profiles.role and profiles.agency_id
-- Combined with RLS allowing users to update their own row (id = auth.uid()), any user can:
--   1. Set profiles.role = 'admin' to gain admin access
--   2. Set profiles.agency_id to any UUID to access any agency's data
--
-- This completely bypasses has_agency_access() and all RLS policies.
--
-- Fix: Revoke column-level privileges on sensitive fields from untrusted roles.
-- Only service_role (used by edge functions) should be able to modify these.

-- Revoke UPDATE on sensitive columns
REVOKE UPDATE (role, agency_id) ON public.profiles FROM PUBLIC;
REVOKE UPDATE (role, agency_id) ON public.profiles FROM anon;
REVOKE UPDATE (role, agency_id) ON public.profiles FROM authenticated;

-- Revoke INSERT on sensitive columns (prevents self-assignment at creation)
REVOKE INSERT (role, agency_id) ON public.profiles FROM PUBLIC;
REVOKE INSERT (role, agency_id) ON public.profiles FROM anon;
REVOKE INSERT (role, agency_id) ON public.profiles FROM authenticated;

-- Ensure service_role can still modify these (for admin operations, onboarding, etc.)
GRANT UPDATE (role, agency_id) ON public.profiles TO service_role;
GRANT INSERT (role, agency_id) ON public.profiles TO service_role;

-- Verification query (run after migration):
-- SELECT grantee, privilege_type, column_name
-- FROM information_schema.column_privileges
-- WHERE table_schema = 'public'
--   AND table_name = 'profiles'
--   AND column_name IN ('role', 'agency_id')
-- ORDER BY grantee, column_name, privilege_type;
--
-- Expected: No UPDATE or INSERT for anon, authenticated, or PUBLIC on role/agency_id
