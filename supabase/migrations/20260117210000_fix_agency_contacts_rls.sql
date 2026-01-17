-- Fix RLS policies for agency_contacts and contact_activities
-- The original policies don't handle staff portal sessions correctly

-- Create a general agency access function similar to has_cancel_audit_access
CREATE OR REPLACE FUNCTION has_agency_access(check_agency_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_session_agency_id UUID;
  v_user_role TEXT;
BEGIN
  v_user_id := auth.uid();

  -- Check for staff portal session first (stored in user metadata)
  SELECT
    (raw_user_meta_data->>'staff_agency_id')::UUID
  INTO v_session_agency_id
  FROM auth.users
  WHERE id = v_user_id;

  -- If staff portal session, check agency match
  IF v_session_agency_id IS NOT NULL THEN
    RETURN v_session_agency_id = check_agency_id;
  END IF;

  -- Check if admin (can access all agencies)
  SELECT role INTO v_user_role
  FROM profiles
  WHERE id = v_user_id;

  IF v_user_role = 'admin' THEN
    RETURN true;
  END IF;

  -- Otherwise check regular profile agency match
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = v_user_id
    AND agency_id = check_agency_id
  );
END;
$$;

COMMENT ON FUNCTION has_agency_access IS 'Check if current user has access to a specific agency (handles staff portal and regular auth)';

-- Drop and recreate agency_contacts policies
DROP POLICY IF EXISTS "agency_contacts_user_policy" ON agency_contacts;
DROP POLICY IF EXISTS "agency_contacts_select" ON agency_contacts;
DROP POLICY IF EXISTS "agency_contacts_insert" ON agency_contacts;
DROP POLICY IF EXISTS "agency_contacts_update" ON agency_contacts;
DROP POLICY IF EXISTS "agency_contacts_delete" ON agency_contacts;

CREATE POLICY "agency_contacts_select" ON agency_contacts
  FOR SELECT USING (has_agency_access(agency_id));

CREATE POLICY "agency_contacts_insert" ON agency_contacts
  FOR INSERT WITH CHECK (has_agency_access(agency_id));

CREATE POLICY "agency_contacts_update" ON agency_contacts
  FOR UPDATE USING (has_agency_access(agency_id));

CREATE POLICY "agency_contacts_delete" ON agency_contacts
  FOR DELETE USING (has_agency_access(agency_id));

-- Drop and recreate contact_activities policies
DROP POLICY IF EXISTS "contact_activities_user_policy" ON contact_activities;
DROP POLICY IF EXISTS "contact_activities_select" ON contact_activities;
DROP POLICY IF EXISTS "contact_activities_insert" ON contact_activities;
DROP POLICY IF EXISTS "contact_activities_update" ON contact_activities;
DROP POLICY IF EXISTS "contact_activities_delete" ON contact_activities;

CREATE POLICY "contact_activities_select" ON contact_activities
  FOR SELECT USING (has_agency_access(agency_id));

CREATE POLICY "contact_activities_insert" ON contact_activities
  FOR INSERT WITH CHECK (has_agency_access(agency_id));

CREATE POLICY "contact_activities_update" ON contact_activities
  FOR UPDATE USING (has_agency_access(agency_id));

CREATE POLICY "contact_activities_delete" ON contact_activities
  FOR DELETE USING (has_agency_access(agency_id));

-- Verification query:
-- SELECT policyname, tablename, cmd FROM pg_policies
-- WHERE tablename IN ('agency_contacts', 'contact_activities');
