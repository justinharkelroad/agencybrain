-- Force RLS for table owner (critical security measure)
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

-- Drop all existing policies to rebuild securely
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Agency owners can view agency profiles" ON public.profiles;

-- Create secure policies with explicit TO authenticated

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Agency members can view profiles in their agency (needed for team features)
CREATE POLICY "Agency members can view agency profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  agency_id IS NOT NULL 
  AND agency_id IN (
    SELECT p.agency_id FROM public.profiles p WHERE p.id = auth.uid()
  )
);

-- Admins can view all profiles (uses has_role function for security)
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

-- Users can update their own profile (excluding role field - handled by trigger)
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Admins can update any profile
CREATE POLICY "Admins can update any profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));