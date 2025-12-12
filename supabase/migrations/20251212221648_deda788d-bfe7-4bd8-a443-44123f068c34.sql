-- Allow agency members to read their agency's call scoring settings
DROP POLICY IF EXISTS "Agency members can view their call scoring settings" ON agency_call_scoring_settings;

CREATE POLICY "Agency members can view their call scoring settings"
ON agency_call_scoring_settings FOR SELECT
TO authenticated
USING (
  agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid())
);