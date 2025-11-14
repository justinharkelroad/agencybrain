-- Create binaural-beats storage bucket for 21-minute theta background track
-- Private bucket with 120MB limit for the 117MB audio file

-- Insert the bucket configuration
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'binaural-beats',
  'binaural-beats',
  false,  -- Private bucket (authenticated access only)
  125829120,  -- 120MB limit (117MB file + buffer)
  ARRAY['audio/mpeg', 'audio/mp3', 'audio/wav']
)
ON CONFLICT (id) DO NOTHING;

-- RLS Policy: Only admins can upload binaural beats files
CREATE POLICY "Admins can upload binaural beats"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'binaural-beats' 
  AND has_role(auth.uid(), 'admin')
);

-- RLS Policy: All authenticated users can view/download binaural beats
-- (Required for client-side ThetaAudioMixer to load the background track)
CREATE POLICY "Authenticated users can view binaural beats"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'binaural-beats' 
  AND auth.uid() IS NOT NULL
);

-- RLS Policy: Only admins can delete binaural beats files
CREATE POLICY "Admins can delete binaural beats"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'binaural-beats' 
  AND has_role(auth.uid(), 'admin')
);

-- RLS Policy: Only admins can update binaural beats file metadata
CREATE POLICY "Admins can update binaural beats"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'binaural-beats' 
  AND has_role(auth.uid(), 'admin')
)
WITH CHECK (
  bucket_id = 'binaural-beats' 
  AND has_role(auth.uid(), 'admin')
);