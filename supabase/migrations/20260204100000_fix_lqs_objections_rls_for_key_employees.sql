-- Fix lqs_objections RLS to use has_agency_access()
-- This allows key employees and linked staff users to access objections
-- Previously, the policy only checked profiles.agency_id which excludes:
-- - Key employees (agency_id is in key_employees table)
-- - Staff users with linked_profile_id (agency_id is in staff_users table)

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their agency objections" ON public.lqs_objections;
DROP POLICY IF EXISTS "Users can insert objections for their agency" ON public.lqs_objections;
DROP POLICY IF EXISTS "Users can update their agency objections" ON public.lqs_objections;
DROP POLICY IF EXISTS "Users can delete their agency objections" ON public.lqs_objections;

-- Create new policies using has_agency_access()
CREATE POLICY "Users can view their agency objections"
  ON public.lqs_objections FOR SELECT
  TO authenticated
  USING (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Users can insert objections for their agency"
  ON public.lqs_objections FOR INSERT
  TO authenticated
  WITH CHECK (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Users can update their agency objections"
  ON public.lqs_objections FOR UPDATE
  TO authenticated
  USING (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Users can delete their agency objections"
  ON public.lqs_objections FOR DELETE
  TO authenticated
  USING (has_agency_access(auth.uid(), agency_id));
