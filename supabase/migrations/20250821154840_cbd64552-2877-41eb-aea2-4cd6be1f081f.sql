-- Add RLS policy to allow admin users to access all files
CREATE POLICY "Admin users can access all files" 
ON storage.objects 
FOR SELECT 
TO authenticated
USING (
  bucket_id = 'uploads' 
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

-- Add RLS policy to allow users in the same agency to access files
CREATE POLICY "Agency users can access files from same agency" 
ON storage.objects 
FOR SELECT 
TO authenticated
USING (
  bucket_id = 'uploads' 
  AND EXISTS (
    SELECT 1 FROM public.profiles user_profile
    JOIN public.profiles file_owner_profile ON file_owner_profile.agency_id = user_profile.agency_id
    WHERE user_profile.id = auth.uid() 
    AND file_owner_profile.id::text = (storage.foldername(name))[1]
  )
);