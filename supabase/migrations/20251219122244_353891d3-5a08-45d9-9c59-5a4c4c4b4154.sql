-- Step 1: Drop the broken recursive policy
DROP POLICY IF EXISTS "Agency members can view agency profiles" ON public.profiles;

-- Step 2: Create get_my_agency_id() SECURITY DEFINER function
CREATE OR REPLACE FUNCTION public.get_my_agency_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT agency_id FROM public.profiles WHERE id = auth.uid() LIMIT 1
$$;

-- Step 3: Create non-recursive agency policy using the safe function
CREATE POLICY "Users can view agency profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (agency_id IS NOT NULL AND agency_id = public.get_my_agency_id());