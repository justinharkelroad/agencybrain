-- Add public SELECT policy for agencies (needed for nested select in resolve_public_form)
CREATE POLICY "public_can_select_agency_basic" ON agencies
FOR SELECT
TO public
USING (true);