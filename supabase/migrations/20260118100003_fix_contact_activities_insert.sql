-- Fix contact_activities INSERT permission issue
-- Create a SECURITY DEFINER function to insert activities
-- This bypasses RLS issues when called from staff portal sessions

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
    created_by_user_id,
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
    p_created_by_user_id,
    p_created_by_staff_id,
    p_created_by_display_name
  )
  RETURNING id INTO v_activity_id;

  RETURN v_activity_id;
END;
$$;

-- Grant execute to authenticated and anon users (RPC calls)
GRANT EXECUTE ON FUNCTION insert_contact_activity TO authenticated;
GRANT EXECUTE ON FUNCTION insert_contact_activity TO anon;

COMMENT ON FUNCTION insert_contact_activity IS 'Insert contact activity with SECURITY DEFINER to bypass RLS issues for staff portal sessions';
