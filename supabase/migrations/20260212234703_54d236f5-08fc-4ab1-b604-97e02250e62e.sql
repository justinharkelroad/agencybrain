
-- Add UPDATE policy for training-assets (needed for upsert uploads)
CREATE POLICY "Authenticated users can update training assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'training-assets')
WITH CHECK (bucket_id = 'training-assets');
