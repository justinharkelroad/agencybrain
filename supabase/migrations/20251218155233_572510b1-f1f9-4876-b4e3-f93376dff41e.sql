-- Allow anonymous users (staff) to read training comments
CREATE POLICY "Anon users can view training comments"
ON public.training_comments
FOR SELECT
TO anon
USING (true);