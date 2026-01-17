-- Fix RLS policies for agency_contacts and contact_activities
-- Use the PROVEN has_cancel_audit_access function that works for other tables

-- Drop and recreate agency_contacts policies
DROP POLICY IF EXISTS "agency_contacts_user_policy" ON agency_contacts;
DROP POLICY IF EXISTS "agency_contacts_select" ON agency_contacts;
DROP POLICY IF EXISTS "agency_contacts_insert" ON agency_contacts;
DROP POLICY IF EXISTS "agency_contacts_update" ON agency_contacts;
DROP POLICY IF EXISTS "agency_contacts_delete" ON agency_contacts;

CREATE POLICY "agency_contacts_select" ON agency_contacts
  FOR SELECT USING (has_cancel_audit_access(agency_id));

CREATE POLICY "agency_contacts_insert" ON agency_contacts
  FOR INSERT WITH CHECK (has_cancel_audit_access(agency_id));

CREATE POLICY "agency_contacts_update" ON agency_contacts
  FOR UPDATE USING (has_cancel_audit_access(agency_id));

CREATE POLICY "agency_contacts_delete" ON agency_contacts
  FOR DELETE USING (has_cancel_audit_access(agency_id));

-- Drop and recreate contact_activities policies
DROP POLICY IF EXISTS "contact_activities_user_policy" ON contact_activities;
DROP POLICY IF EXISTS "contact_activities_select" ON contact_activities;
DROP POLICY IF EXISTS "contact_activities_insert" ON contact_activities;
DROP POLICY IF EXISTS "contact_activities_update" ON contact_activities;
DROP POLICY IF EXISTS "contact_activities_delete" ON contact_activities;

CREATE POLICY "contact_activities_select" ON contact_activities
  FOR SELECT USING (has_cancel_audit_access(agency_id));

CREATE POLICY "contact_activities_insert" ON contact_activities
  FOR INSERT WITH CHECK (has_cancel_audit_access(agency_id));

CREATE POLICY "contact_activities_update" ON contact_activities
  FOR UPDATE USING (has_cancel_audit_access(agency_id));

CREATE POLICY "contact_activities_delete" ON contact_activities
  FOR DELETE USING (has_cancel_audit_access(agency_id));

-- Verification query:
-- SELECT policyname, tablename, cmd FROM pg_policies
-- WHERE tablename IN ('agency_contacts', 'contact_activities');
