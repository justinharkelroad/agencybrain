-- Manage sequence instances: complete, pause, resume
-- Supports both JWT (agency portal) and staff session (staff portal) auth

-- Add 'paused' to instance status enum (idempotent)
DO $$ BEGIN
  ALTER TYPE onboarding_instance_status ADD VALUE IF NOT EXISTS 'paused';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION manage_sequence_instance(
  p_instance_id UUID,
  p_action TEXT,  -- 'complete' | 'pause' | 'resume'
  p_agency_id UUID,
  p_completed_by_user_id UUID DEFAULT NULL,
  p_completed_by_staff_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_staff_session_token TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_instance RECORD;
  v_affected_count INT;
  v_staff_member_id UUID;
  v_contact_id UUID;
  v_seq_name TEXT;
BEGIN
  -- Deny-by-default auth
  IF auth.uid() IS NOT NULL THEN
    IF NOT has_agency_access(auth.uid(), p_agency_id) THEN
      RAISE EXCEPTION 'unauthorized' USING ERRCODE = '28000';
    END IF;
  ELSIF p_staff_session_token IS NOT NULL THEN
    v_staff_member_id := verify_staff_session(p_staff_session_token, p_agency_id);
    IF v_staff_member_id IS NULL THEN
      RAISE EXCEPTION 'unauthorized' USING ERRCODE = '28000';
    END IF;
  ELSE
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '28000';
  END IF;

  -- Fetch and verify instance belongs to agency
  SELECT oi.id, oi.status, oi.contact_id, os.name
  INTO v_instance
  FROM onboarding_instances oi
  LEFT JOIN onboarding_sequences os ON os.id = oi.sequence_id
  WHERE oi.id = p_instance_id AND oi.agency_id = p_agency_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Instance not found or does not belong to this agency' USING ERRCODE = 'P0002';
  END IF;

  v_contact_id := v_instance.contact_id;
  v_seq_name := COALESCE(v_instance.name, 'Sequence');

  IF p_action = 'complete' THEN
    -- Idempotent: already completed → no-op
    IF v_instance.status = 'completed' THEN
      RETURN jsonb_build_object('success', true, 'tasks_completed', 0, 'message', 'Already completed');
    END IF;

    -- Complete the instance
    UPDATE onboarding_instances
    SET status = 'completed', completed_at = now(), updated_at = now()
    WHERE id = p_instance_id;

    -- Complete all non-completed tasks
    WITH updated AS (
      UPDATE onboarding_tasks
      SET status = 'completed',
          completed_at = now(),
          completed_by_user_id = p_completed_by_user_id,
          completed_by_staff_user_id = p_completed_by_staff_id,
          completion_notes = COALESCE(p_notes, 'Sequence completed (bulk)'),
          updated_at = now()
      WHERE instance_id = p_instance_id
        AND status != 'completed'
      RETURNING id
    )
    SELECT count(*) INTO v_affected_count FROM updated;

    -- Log activity to contact timeline
    IF v_contact_id IS NOT NULL THEN
      PERFORM insert_contact_activity(
        p_agency_id := p_agency_id,
        p_contact_id := v_contact_id,
        p_source_module := 'manual',
        p_activity_type := 'status_change',
        p_subject := v_seq_name || ' completed',
        p_notes := COALESCE(p_notes, v_seq_name || ' completed — ' || v_affected_count || ' remaining task(s) marked done'),
        p_created_by_user_id := p_completed_by_user_id,
        p_created_by_staff_id := p_completed_by_staff_id,
        p_created_by_display_name := 'System'
      );
    END IF;

    RETURN jsonb_build_object('success', true, 'tasks_completed', v_affected_count);

  ELSIF p_action = 'pause' THEN
    IF v_instance.status = 'paused' THEN
      RETURN jsonb_build_object('success', true, 'message', 'Already paused');
    END IF;

    IF v_instance.status = 'completed' THEN
      RETURN jsonb_build_object('success', false, 'message', 'Cannot pause a completed sequence');
    END IF;

    UPDATE onboarding_instances
    SET status = 'paused', updated_at = now()
    WHERE id = p_instance_id;

    -- Log activity
    IF v_contact_id IS NOT NULL THEN
      PERFORM insert_contact_activity(
        p_agency_id := p_agency_id,
        p_contact_id := v_contact_id,
        p_source_module := 'manual',
        p_activity_type := 'status_change',
        p_subject := v_seq_name || ' paused',
        p_notes := COALESCE(p_notes, v_seq_name || ' paused — remaining tasks removed from queue'),
        p_created_by_user_id := p_completed_by_user_id,
        p_created_by_staff_id := p_completed_by_staff_id,
        p_created_by_display_name := 'System'
      );
    END IF;

    RETURN jsonb_build_object('success', true);

  ELSIF p_action = 'resume' THEN
    IF v_instance.status != 'paused' THEN
      RETURN jsonb_build_object('success', false, 'message', 'Can only resume a paused sequence');
    END IF;

    UPDATE onboarding_instances
    SET status = 'active', updated_at = now()
    WHERE id = p_instance_id;

    -- Log activity
    IF v_contact_id IS NOT NULL THEN
      PERFORM insert_contact_activity(
        p_agency_id := p_agency_id,
        p_contact_id := v_contact_id,
        p_source_module := 'manual',
        p_activity_type := 'status_change',
        p_subject := v_seq_name || ' resumed',
        p_notes := COALESCE(p_notes, v_seq_name || ' resumed — tasks restored to queue'),
        p_created_by_user_id := p_completed_by_user_id,
        p_created_by_staff_id := p_completed_by_staff_id,
        p_created_by_display_name := 'System'
      );
    END IF;

    RETURN jsonb_build_object('success', true);

  ELSE
    RAISE EXCEPTION 'Invalid action: %', p_action USING ERRCODE = 'P0001';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION manage_sequence_instance FROM PUBLIC;
GRANT EXECUTE ON FUNCTION manage_sequence_instance TO authenticated;
GRANT EXECUTE ON FUNCTION manage_sequence_instance TO anon;
