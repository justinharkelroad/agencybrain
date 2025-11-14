-- Drop the old authenticated-only policy
DROP POLICY IF EXISTS "Authenticated users can view binaural beats" ON storage.objects;

-- Create new public policy allowing anyone to read from binaural-beats bucket
CREATE POLICY "Anyone can view binaural beats"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'binaural-beats');