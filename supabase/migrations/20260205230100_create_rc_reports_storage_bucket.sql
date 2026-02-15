-- Create storage bucket for RingCentral report uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('rc-reports', 'rc-reports', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their own agency folder
CREATE POLICY "Users can upload rc reports"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'rc-reports'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] IN (
    SELECT a.id::text FROM agencies a
    JOIN profiles p ON p.agency_id = a.id
    WHERE p.id = auth.uid()
  )
);

-- Allow authenticated users to read their agency's reports
CREATE POLICY "Users can view rc reports"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'rc-reports'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] IN (
    SELECT a.id::text FROM agencies a
    JOIN profiles p ON p.agency_id = a.id
    WHERE p.id = auth.uid()
  )
);

-- Allow upsert (update existing files with same name)
CREATE POLICY "Users can update rc reports"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'rc-reports'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] IN (
    SELECT a.id::text FROM agencies a
    JOIN profiles p ON p.agency_id = a.id
    WHERE p.id = auth.uid()
  )
);
