-- Create storage bucket for call recordings
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'call-recordings',
  'call-recordings',
  false,
  26214400,
  ARRAY['audio/mpeg', 'audio/wav', 'audio/x-m4a', 'audio/ogg', 'audio/mp4', 'audio/x-wav']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for call-recordings bucket
CREATE POLICY "Authenticated users can upload call recordings"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'call-recordings');

CREATE POLICY "Users can read their own call recordings"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'call-recordings');