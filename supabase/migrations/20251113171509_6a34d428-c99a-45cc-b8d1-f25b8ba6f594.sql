-- Create storage bucket for theta tracks
INSERT INTO storage.buckets (id, name, public)
VALUES ('theta-tracks', 'theta-tracks', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to upload to theta-tracks bucket (public feature)
CREATE POLICY "Anyone can upload theta tracks"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'theta-tracks');

-- Allow anyone to read from theta-tracks bucket
CREATE POLICY "Anyone can view theta tracks"
ON storage.objects FOR SELECT
USING (bucket_id = 'theta-tracks');