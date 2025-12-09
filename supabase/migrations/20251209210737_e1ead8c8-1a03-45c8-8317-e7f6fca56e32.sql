-- Create storage bucket for agency logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('agency-logos', 'agency-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their own agency folder
CREATE POLICY "Users can upload agency logos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'agency-logos' 
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] IN (
    SELECT a.id::text FROM agencies a
    JOIN profiles p ON p.agency_id = a.id
    WHERE p.id = auth.uid()
  )
);

-- Allow public read access to agency logos
CREATE POLICY "Anyone can view agency logos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'agency-logos');

-- Allow users to update/delete their agency logo
CREATE POLICY "Users can update agency logos"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'agency-logos' 
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] IN (
    SELECT a.id::text FROM agencies a
    JOIN profiles p ON p.agency_id = a.id
    WHERE p.id = auth.uid()
  )
);

CREATE POLICY "Users can delete agency logos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'agency-logos' 
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] IN (
    SELECT a.id::text FROM agencies a
    JOIN profiles p ON p.agency_id = a.id
    WHERE p.id = auth.uid()
  )
);