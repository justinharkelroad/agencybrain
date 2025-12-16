-- Create the training-assets storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('training-assets', 'training-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload training assets
CREATE POLICY "Authenticated users can upload training assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'training-assets');

-- Allow public read access to training assets
CREATE POLICY "Public can view training assets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'training-assets');

-- Allow authenticated users to delete training assets
CREATE POLICY "Authenticated users can delete training assets"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'training-assets');