-- Cleanup duplicate policies on contact_activities
-- The old *_policy versions are redundant after the RLS fix migration

DROP POLICY IF EXISTS "contact_activities_select_policy" ON contact_activities;
DROP POLICY IF EXISTS "contact_activities_insert_policy" ON contact_activities;
DROP POLICY IF EXISTS "contact_activities_update_policy" ON contact_activities;
DROP POLICY IF EXISTS "contact_activities_delete_policy" ON contact_activities;
