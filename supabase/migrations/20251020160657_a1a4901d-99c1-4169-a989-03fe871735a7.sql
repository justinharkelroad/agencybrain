-- Fix RLS policies for quoted_household_details to prevent public exposure
-- Drop the overly permissive ALL policy
DROP POLICY IF EXISTS "Users can manage quoted details via submissions" ON quoted_household_details;

-- Create separate, explicit policies for each operation

-- SELECT: Only authenticated users with agency access can read
CREATE POLICY "Authenticated agency users can read quoted details"
ON quoted_household_details
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM submissions s
    JOIN form_templates ft ON ft.id = s.form_template_id
    WHERE s.id = quoted_household_details.submission_id
      AND has_agency_access(auth.uid(), ft.agency_id)
  )
);

-- INSERT: Only service role can insert (via edge functions)
-- No policy needed as edge functions use service role

-- UPDATE: Only authenticated users with agency access can update
CREATE POLICY "Authenticated agency users can update quoted details"
ON quoted_household_details
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM submissions s
    JOIN form_templates ft ON ft.id = s.form_template_id
    WHERE s.id = quoted_household_details.submission_id
      AND has_agency_access(auth.uid(), ft.agency_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM submissions s
    JOIN form_templates ft ON ft.id = s.form_template_id
    WHERE s.id = quoted_household_details.submission_id
      AND has_agency_access(auth.uid(), ft.agency_id)
  )
);

-- DELETE: Only authenticated users with agency access can delete
CREATE POLICY "Authenticated agency users can delete quoted details"
ON quoted_household_details
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM submissions s
    JOIN form_templates ft ON ft.id = s.form_template_id
    WHERE s.id = quoted_household_details.submission_id
      AND has_agency_access(auth.uid(), ft.agency_id)
  )
);