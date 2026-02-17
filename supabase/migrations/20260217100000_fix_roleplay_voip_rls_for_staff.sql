-- Fix roleplay_access_tokens and voip_integrations RLS for key employees + staff managers
-- Bug: Both tables used direct profiles subqueries instead of has_agency_access(),
-- blocking key employees and staff managers from accessing features they need.

-- =============================================================================
-- roleplay_access_tokens
-- =============================================================================
-- Access should be granted to: agency owners, key employees, staff managers
-- The original policies used: SELECT agency_id FROM profiles WHERE id = auth.uid()
-- which blocks key employees (agency_id in key_employees table) and staff managers

DROP POLICY IF EXISTS "users_can_select_own_agency_tokens" ON roleplay_access_tokens;
DROP POLICY IF EXISTS "users_can_update_own_agency_tokens" ON roleplay_access_tokens;
DROP POLICY IF EXISTS "Users can view their own tokens" ON roleplay_access_tokens;
DROP POLICY IF EXISTS "Users can create tokens" ON roleplay_access_tokens;

-- SELECT: agency owners, key employees, staff managers, and admins
CREATE POLICY "agency_members_select_roleplay_tokens"
  ON roleplay_access_tokens FOR SELECT
  USING (
    has_agency_access(auth.uid(), agency_id)
  );

-- UPDATE: agency owners, key employees, staff managers, and admins
CREATE POLICY "agency_members_update_roleplay_tokens"
  ON roleplay_access_tokens FOR UPDATE
  USING (
    has_agency_access(auth.uid(), agency_id)
  );

-- INSERT: agency owners, key employees, and admins can create tokens
CREATE POLICY "agency_members_insert_roleplay_tokens"
  ON roleplay_access_tokens FOR INSERT
  WITH CHECK (
    has_agency_access(auth.uid(), agency_id)
  );

-- =============================================================================
-- voip_integrations (manage policy)
-- =============================================================================
-- Bug: The ALL policy used direct profiles check for owner/admin roles,
-- blocking staff managers with linked profiles from managing VoIP settings.
-- Fix: Use has_agency_access() combined with a role check for manager-level access.

DROP POLICY IF EXISTS "Agency owners manage voip_integrations" ON voip_integrations;

CREATE POLICY "Agency owners manage voip_integrations"
  ON voip_integrations FOR ALL
  USING (
    -- Admins can manage any agency's VoIP
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
    -- Agency owners can manage their own VoIP
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND agency_id = voip_integrations.agency_id
      AND role = 'owner'
    )
    -- Key employees can manage their agency's VoIP
    OR EXISTS (
      SELECT 1 FROM key_employees
      WHERE user_id = auth.uid()
      AND agency_id = voip_integrations.agency_id
    )
    -- Staff managers (via linked profile) can manage their agency's VoIP
    OR EXISTS (
      SELECT 1 FROM staff_users su
      JOIN team_members tm ON tm.id = su.team_member_id
      WHERE su.linked_profile_id = auth.uid()
      AND su.agency_id = voip_integrations.agency_id
      AND su.is_active = true
      AND lower(coalesce(tm.role::text, '')) IN ('manager', 'owner')
    )
  );
