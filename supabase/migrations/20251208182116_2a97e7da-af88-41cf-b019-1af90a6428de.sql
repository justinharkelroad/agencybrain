-- Security fix: Remove public access to roleplay_access_tokens table
-- This fixes a session hijacking vulnerability where USING (true) policies exposed staff emails and tokens

-- Drop the overly permissive public policies
DROP POLICY IF EXISTS "Public can validate tokens" ON roleplay_access_tokens;
DROP POLICY IF EXISTS "Public can update token usage" ON roleplay_access_tokens;

-- Add proper restricted policies for authenticated users only
CREATE POLICY "users_can_select_own_agency_tokens" ON roleplay_access_tokens
  FOR SELECT
  USING (
    agency_id IN (
      SELECT agency_id FROM profiles WHERE id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "users_can_update_own_agency_tokens" ON roleplay_access_tokens
  FOR UPDATE
  USING (
    agency_id IN (
      SELECT agency_id FROM profiles WHERE id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );