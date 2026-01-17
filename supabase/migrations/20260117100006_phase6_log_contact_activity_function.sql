-- Phase 6: Create log_contact_activity function
-- Helper function to log activities to the contact_activities table

CREATE OR REPLACE FUNCTION public.log_contact_activity(
  p_contact_id uuid,
  p_agency_id uuid,
  p_source_module text,
  p_activity_type text,
  p_source_record_id uuid DEFAULT NULL,
  p_activity_subtype text DEFAULT NULL,
  p_phone_number text DEFAULT NULL,
  p_call_direction text DEFAULT NULL,
  p_call_duration_seconds integer DEFAULT NULL,
  p_call_recording_url text DEFAULT NULL,
  p_subject text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_outcome text DEFAULT NULL,
  p_created_by_user_id uuid DEFAULT NULL,
  p_created_by_staff_id uuid DEFAULT NULL,
  p_created_by_display_name text DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_activity_id uuid;
BEGIN
  INSERT INTO contact_activities (
    contact_id, agency_id, source_module, source_record_id,
    activity_type, activity_subtype, phone_number, call_direction,
    call_duration_seconds, call_recording_url, subject, notes, outcome,
    created_by_user_id, created_by_staff_id, created_by_display_name
  ) VALUES (
    p_contact_id, p_agency_id, p_source_module, p_source_record_id,
    p_activity_type, p_activity_subtype, normalize_phone(p_phone_number), p_call_direction,
    p_call_duration_seconds, p_call_recording_url, p_subject, p_notes, p_outcome,
    p_created_by_user_id, p_created_by_staff_id, p_created_by_display_name
  )
  RETURNING id INTO v_activity_id;

  RETURN v_activity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verification query (run after migration):
-- SELECT routine_name FROM information_schema.routines WHERE routine_name = 'log_contact_activity';
