-- Add PDF URL column to help_videos table
ALTER TABLE help_videos ADD COLUMN IF NOT EXISTS pdf_url TEXT;

-- Create storage bucket for help PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('help-pdfs', 'help-pdfs', true)
ON CONFLICT (id) DO NOTHING;

-- Public can read help PDFs
DROP POLICY IF EXISTS "Public can read help PDFs" ON storage.objects;
CREATE POLICY "Public can read help PDFs"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'help-pdfs');

-- Only admins can upload help PDFs
DROP POLICY IF EXISTS "Admins can upload help PDFs" ON storage.objects;
CREATE POLICY "Admins can upload help PDFs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'help-pdfs' 
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

-- Admins can update help PDFs
DROP POLICY IF EXISTS "Admins can update help PDFs" ON storage.objects;
CREATE POLICY "Admins can update help PDFs"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'help-pdfs' 
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

-- Admins can delete help PDFs
DROP POLICY IF EXISTS "Admins can delete help PDFs" ON storage.objects;
CREATE POLICY "Admins can delete help PDFs"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'help-pdfs' 
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);