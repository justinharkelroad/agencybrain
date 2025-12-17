-- Allow users to view profiles of key employees in their same agency
CREATE POLICY "Users can view key employee profiles in same agency"
ON public.profiles FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT ke.user_id FROM public.key_employees ke
    WHERE ke.agency_id = (
      SELECT p.agency_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  )
);