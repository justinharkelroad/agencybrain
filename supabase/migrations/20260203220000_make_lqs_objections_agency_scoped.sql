-- Make lqs_objections agency-scoped instead of global
-- Each agency can manage their own objections list

-- Add agency_id column
ALTER TABLE public.lqs_objections
  ADD COLUMN agency_id uuid REFERENCES public.agencies(id) ON DELETE CASCADE;

-- Drop the global unique constraint on name
ALTER TABLE public.lqs_objections
  DROP CONSTRAINT IF EXISTS lqs_objections_name_key;

-- Add unique constraint per agency
ALTER TABLE public.lqs_objections
  ADD CONSTRAINT lqs_objections_agency_name_unique UNIQUE (agency_id, name);

-- Add index for agency lookups
CREATE INDEX idx_lqs_objections_agency ON public.lqs_objections(agency_id);

-- Drop old RLS policies
DROP POLICY IF EXISTS "Anyone can view active objections" ON public.lqs_objections;
DROP POLICY IF EXISTS "Admins can view all objections" ON public.lqs_objections;
DROP POLICY IF EXISTS "Admins can insert objections" ON public.lqs_objections;
DROP POLICY IF EXISTS "Admins can update objections" ON public.lqs_objections;
DROP POLICY IF EXISTS "Admins can delete objections" ON public.lqs_objections;

-- Create agency-scoped RLS policies
CREATE POLICY "Users can view their agency objections"
  ON public.lqs_objections FOR SELECT
  TO authenticated
  USING (
    agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Users can insert objections for their agency"
  ON public.lqs_objections FOR INSERT
  TO authenticated
  WITH CHECK (
    agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Users can update their agency objections"
  ON public.lqs_objections FOR UPDATE
  TO authenticated
  USING (
    agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Users can delete their agency objections"
  ON public.lqs_objections FOR DELETE
  TO authenticated
  USING (
    agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid())
  );
