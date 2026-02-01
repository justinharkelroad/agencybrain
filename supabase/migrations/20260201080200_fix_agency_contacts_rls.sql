-- Phase 1B: Update agency_contacts RLS to use has_agency_access
--
-- This aligns agency_contacts with lqs_households RLS behavior:
-- - Admin can access all agencies
-- - Key employees can access their agencies
-- - Regular users can access their profile's agency
--
-- Note: has_cancel_audit_access now delegates to has_agency_access anyway (Phase 0),
-- but this makes the intent clearer and removes the extra function call.

-- Drop and recreate agency_contacts policies
DROP POLICY IF EXISTS "agency_contacts_user_policy" ON agency_contacts;
DROP POLICY IF EXISTS "agency_contacts_select" ON agency_contacts;
DROP POLICY IF EXISTS "agency_contacts_insert" ON agency_contacts;
DROP POLICY IF EXISTS "agency_contacts_update" ON agency_contacts;
DROP POLICY IF EXISTS "agency_contacts_delete" ON agency_contacts;

CREATE POLICY "agency_contacts_select" ON agency_contacts
  FOR SELECT USING (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "agency_contacts_insert" ON agency_contacts
  FOR INSERT WITH CHECK (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "agency_contacts_update" ON agency_contacts
  FOR UPDATE USING (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "agency_contacts_delete" ON agency_contacts
  FOR DELETE USING (has_agency_access(auth.uid(), agency_id));

-- Drop and recreate contact_activities policies
DROP POLICY IF EXISTS "contact_activities_user_policy" ON contact_activities;
DROP POLICY IF EXISTS "contact_activities_select" ON contact_activities;
DROP POLICY IF EXISTS "contact_activities_insert" ON contact_activities;
DROP POLICY IF EXISTS "contact_activities_update" ON contact_activities;
DROP POLICY IF EXISTS "contact_activities_delete" ON contact_activities;

CREATE POLICY "contact_activities_select" ON contact_activities
  FOR SELECT USING (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "contact_activities_insert" ON contact_activities
  FOR INSERT WITH CHECK (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "contact_activities_update" ON contact_activities
  FOR UPDATE USING (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "contact_activities_delete" ON contact_activities
  FOR DELETE USING (has_agency_access(auth.uid(), agency_id));

-- Verification query:
-- SELECT policyname, tablename, cmd, qual::text, with_check::text
-- FROM pg_policies
-- WHERE tablename IN ('agency_contacts', 'contact_activities');
