-- Allow anonymous users (staff) to create training comments
CREATE POLICY "Anon users can create training comments"
ON public.training_comments
FOR INSERT
TO anon
WITH CHECK (true);