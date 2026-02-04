-- Fix remaining tables that use direct profile checks instead of has_agency_access()
-- This allows key employees and linked staff users to access agency data

-- =============================================================================
-- subscriptions - key employees need to see subscription status
-- =============================================================================
DROP POLICY IF EXISTS "Users can view their agency subscription" ON subscriptions;

CREATE POLICY "Users can view their agency subscription"
  ON subscriptions FOR SELECT
  USING (has_agency_access(auth.uid(), agency_id));

-- Service role policy should remain unchanged (already exists)

-- =============================================================================
-- agency_call_scoring_settings
-- =============================================================================
DROP POLICY IF EXISTS "Agency owners can view their settings" ON agency_call_scoring_settings;

CREATE POLICY "Agency members can view their settings"
  ON agency_call_scoring_settings FOR SELECT
  TO authenticated
  USING (has_agency_access(auth.uid(), agency_id));

-- Admin policy should remain unchanged

-- =============================================================================
-- meeting_frames
-- =============================================================================
DROP POLICY IF EXISTS "Users can view meeting frames for their agency" ON meeting_frames;
DROP POLICY IF EXISTS "Users can create meeting frames for their agency" ON meeting_frames;

CREATE POLICY "Users can view meeting frames for their agency"
  ON meeting_frames FOR SELECT
  TO authenticated
  USING (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Users can create meeting frames for their agency"
  ON meeting_frames FOR INSERT
  TO authenticated
  WITH CHECK (has_agency_access(auth.uid(), agency_id));

-- Delete policy based on created_by should remain unchanged
