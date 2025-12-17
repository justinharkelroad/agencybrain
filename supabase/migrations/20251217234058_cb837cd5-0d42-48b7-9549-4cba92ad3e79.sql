-- EMERGENCY FIX: Remove infinite recursion policy

-- Step 1: Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "Users can view key employee profiles in same agency" ON public.profiles;

-- Step 2: Create a SECURITY DEFINER function to safely get user's agency_id
-- This bypasses RLS and prevents the recursive loop
CREATE OR REPLACE FUNCTION public.get_user_agency_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT agency_id FROM profiles WHERE id = _user_id LIMIT 1
$$;

-- Step 3: Create fixed policy using the safe function
CREATE POLICY "Users can view key employee profiles in same agency"
ON public.profiles FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT ke.user_id FROM public.key_employees ke
    WHERE ke.agency_id = public.get_user_agency_id(auth.uid())
  )
);