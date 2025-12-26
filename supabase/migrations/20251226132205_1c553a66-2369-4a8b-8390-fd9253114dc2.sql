-- Add storage policies for training-assets bucket for video-analysis path

-- Allow authenticated users to upload to video-analysis/ path
CREATE POLICY "Users can upload training videos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'training-assets'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = 'video-analysis'
);

-- Allow authenticated users to read from video-analysis/ path
CREATE POLICY "Users can read training videos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'training-assets'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = 'video-analysis'
);

-- Allow authenticated users to delete from video-analysis/ path (for cleanup)
CREATE POLICY "Users can delete training videos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'training-assets'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = 'video-analysis'
);