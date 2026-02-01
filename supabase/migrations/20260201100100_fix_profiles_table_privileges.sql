-- CRITICAL SECURITY FIX: Table-level privilege revocation for profiles
--
-- Column-level REVOKE doesn't work when table-level UPDATE exists.
-- Must REVOKE table-level UPDATE, then re-GRANT only on safe columns.
--
-- Sensitive columns (admin/service-role only):
--   - agency_id: tenant assignment
--   - role: access level
--   - mrr: billing data
--   - membership_tier: subscription tier
--
-- Safe columns (user can update):
--   - full_name
--   - profile_photo_url
--   - updated_at

-- Step 1: Revoke ALL table-level UPDATE from untrusted roles
REVOKE UPDATE ON public.profiles FROM PUBLIC;
REVOKE UPDATE ON public.profiles FROM anon;
REVOKE UPDATE ON public.profiles FROM authenticated;

-- Step 2: Revoke ALL table-level INSERT from untrusted roles
-- (Profile creation should happen via service_role during signup)
REVOKE INSERT ON public.profiles FROM PUBLIC;
REVOKE INSERT ON public.profiles FROM anon;
REVOKE INSERT ON public.profiles FROM authenticated;

-- Step 3: Re-grant UPDATE only on SAFE columns to authenticated
-- (Users can update their own name, photo, timestamp)
GRANT UPDATE (full_name, profile_photo_url, updated_at) ON public.profiles TO authenticated;

-- Step 4: Re-grant INSERT on safe columns to authenticated
-- (In case profile is created client-side - sensitive fields will be NULL/default)
GRANT INSERT (id, full_name, email, profile_photo_url, created_at, updated_at) ON public.profiles TO authenticated;

-- Step 5: Ensure service_role has full access (for admin operations, onboarding, billing)
GRANT ALL ON public.profiles TO service_role;

-- Verification query:
-- SELECT grantee, privilege_type, column_name
-- FROM information_schema.column_privileges
-- WHERE table_schema = 'public'
--   AND table_name = 'profiles'
--   AND column_name IN ('role', 'agency_id', 'mrr', 'membership_tier')
--   AND privilege_type IN ('UPDATE', 'INSERT')
-- ORDER BY grantee, column_name, privilege_type;
--
-- Expected: Only postgres and service_role should have UPDATE/INSERT on sensitive columns
