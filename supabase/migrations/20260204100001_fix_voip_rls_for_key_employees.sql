-- Fix VOIP tables RLS to use has_agency_access()
-- This allows key employees and linked staff users to access VOIP data
-- Previously, the policy only checked profiles.agency_id which excludes:
-- - Key employees (agency_id is in key_employees table)
-- - Staff users with linked_profile_id (agency_id is in staff_users table)

-- =============================================================================
-- voip_integrations
-- =============================================================================
DROP POLICY IF EXISTS "Agency members view voip_integrations" ON voip_integrations;
DROP POLICY IF EXISTS "Agency owners manage voip_integrations" ON voip_integrations;

-- View policy: anyone with agency access can view
CREATE POLICY "Agency members view voip_integrations"
  ON voip_integrations FOR SELECT
  USING (has_agency_access(auth.uid(), agency_id));

-- Manage policy: only agency owners can modify (check against profiles for owner role)
CREATE POLICY "Agency owners manage voip_integrations"
  ON voip_integrations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND agency_id = voip_integrations.agency_id
      AND role IN ('owner', 'admin')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- =============================================================================
-- call_events
-- =============================================================================
DROP POLICY IF EXISTS "Agency members view call_events" ON call_events;

CREATE POLICY "Agency members view call_events"
  ON call_events FOR SELECT
  USING (has_agency_access(auth.uid(), agency_id));

-- =============================================================================
-- call_metrics_daily
-- =============================================================================
DROP POLICY IF EXISTS "Agency members view call_metrics_daily" ON call_metrics_daily;

CREATE POLICY "Agency members view call_metrics_daily"
  ON call_metrics_daily FOR SELECT
  USING (has_agency_access(auth.uid(), agency_id));
