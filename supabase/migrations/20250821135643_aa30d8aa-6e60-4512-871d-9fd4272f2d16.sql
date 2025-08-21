-- Create the missing trigger for syncing member checklist items when agency files change
CREATE TRIGGER sync_mci_on_file_change
  AFTER INSERT OR UPDATE OR DELETE ON public.agency_files
  FOR EACH ROW 
  EXECUTE FUNCTION public.sync_mci_secured_on_file_change();

-- Ensure the uploads bucket has proper RLS policies for agency files
CREATE POLICY "Allow authenticated users to upload to their own path" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'uploads' 
  AND auth.uid()::text = (string_to_array(name, '/'))[1]
);

CREATE POLICY "Allow authenticated users to view their own uploaded files" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'uploads' 
  AND auth.uid()::text = (string_to_array(name, '/'))[1]
);

CREATE POLICY "Allow authenticated users to delete their own uploaded files" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'uploads' 
  AND auth.uid()::text = (string_to_array(name, '/'))[1]
);