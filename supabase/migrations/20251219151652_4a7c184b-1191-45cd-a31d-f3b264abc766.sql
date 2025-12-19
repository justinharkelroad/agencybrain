-- Add DELETE RLS policy for submissions table
-- Allow authenticated agency users to delete submissions for their agency's forms

CREATE POLICY "Agency users can delete their submissions"
ON public.submissions
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM form_templates ft
    WHERE ft.id = submissions.form_template_id
    AND has_agency_access(auth.uid(), ft.agency_id)
  )
);