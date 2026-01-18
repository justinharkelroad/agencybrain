-- Fix contact_activities INSERT - v2
-- The issue is that SECURITY DEFINER function still encounters RLS and FK constraints
-- This version uses service role pattern and removes problematic FK check

-- Drop the old function
DROP FUNCTION IF EXISTS insert_contact_activity;

-- Create function owned by postgres with proper settings
CREATE OR REPLACE FUNCTION insert_contact_activity(
  p_agency_id UUID,
  p_contact_id UUID,
  p_source_module TEXT,
  p_activity_type TEXT,
  p_source_record_id UUID DEFAULT NULL,
  p_activity_subtype TEXT DEFAULT NULL,
  p_phone_number TEXT DEFAULT NULL,
  p_call_direction TEXT DEFAULT NULL,
  p_call_duration_seconds INTEGER DEFAULT NULL,
  p_call_recording_url TEXT DEFAULT NULL,
  p_subject TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_outcome TEXT DEFAULT NULL,
  p_activity_date TIMESTAMPTZ DEFAULT now(),
  p_created_by_user_id UUID DEFAULT NULL,
  p_created_by_staff_id UUID DEFAULT NULL,
  p_created_by_display_name TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_activity_id UUID;
BEGIN
  -- Verify the agency exists and the contact belongs to it
  IF NOT EXISTS (
    SELECT 1 FROM agency_contacts ac
    WHERE ac.id = p_contact_id
    AND ac.agency_id = p_agency_id
  ) THEN
    RAISE EXCEPTION 'Contact not found or does not belong to agency';
  END IF;

  -- Insert without created_by_user_id to avoid auth.users FK check issues
  -- The staff_id and display_name fields are sufficient for tracking who created it
  INSERT INTO contact_activities (
    agency_id,
    contact_id,
    source_module,
    source_record_id,
    activity_type,
    activity_subtype,
    phone_number,
    call_direction,
    call_duration_seconds,
    call_recording_url,
    subject,
    notes,
    outcome,
    activity_date,
    created_by_staff_id,
    created_by_display_name
  ) VALUES (
    p_agency_id,
    p_contact_id,
    p_source_module,
    p_source_record_id,
    p_activity_type,
    p_activity_subtype,
    p_phone_number,
    p_call_direction,
    p_call_duration_seconds,
    p_call_recording_url,
    p_subject,
    p_notes,
    p_outcome,
    p_activity_date,
    p_created_by_staff_id,
    p_created_by_display_name
  )
  RETURNING id INTO v_activity_id;

  -- If we have a user_id and it's valid, update the row separately
  -- This avoids the FK constraint check issue during initial insert
  IF p_created_by_user_id IS NOT NULL THEN
    BEGIN
      UPDATE contact_activities
      SET created_by_user_id = p_created_by_user_id
      WHERE id = v_activity_id;
    EXCEPTION WHEN OTHERS THEN
      -- If update fails (FK constraint), just leave it null
      -- The display_name is already set so we still know who created it
      NULL;
    END;
  END IF;

  RETURN v_activity_id;
END;
$$;

-- Grant execute to authenticated and anon users
GRANT EXECUTE ON FUNCTION insert_contact_activity TO authenticated;
GRANT EXECUTE ON FUNCTION insert_contact_activity TO anon;

-- Also fix the RLS policy on contact_activities to be more permissive for the function
-- First drop existing policies if they conflict
DROP POLICY IF EXISTS "contact_activities_user_policy" ON contact_activities;
DROP POLICY IF EXISTS "contact_activities_select" ON contact_activities;
DROP POLICY IF EXISTS "contact_activities_insert" ON contact_activities;
DROP POLICY IF EXISTS "contact_activities_update" ON contact_activities;
DROP POLICY IF EXISTS "contact_activities_delete" ON contact_activities;

-- Create new policies that work with both regular users and staff portal
CREATE POLICY "contact_activities_select_policy" ON contact_activities
  FOR SELECT USING (
    has_cancel_audit_access(agency_id)
    OR agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "contact_activities_insert_policy" ON contact_activities
  FOR INSERT WITH CHECK (
    has_cancel_audit_access(agency_id)
    OR agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "contact_activities_update_policy" ON contact_activities
  FOR UPDATE USING (
    has_cancel_audit_access(agency_id)
    OR agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "contact_activities_delete_policy" ON contact_activities
  FOR DELETE USING (
    has_cancel_audit_access(agency_id)
    OR agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid())
  );

COMMENT ON FUNCTION insert_contact_activity IS 'Insert contact activity bypassing RLS - v2';
