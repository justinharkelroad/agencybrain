-- ============================================================
-- Sequence Team Accountability: call_outcome + team stats RPC
-- ============================================================

-- 1. Add call_outcome column to onboarding_tasks
ALTER TABLE onboarding_tasks
  ADD COLUMN IF NOT EXISTS call_outcome TEXT;

ALTER TABLE onboarding_tasks
  ADD CONSTRAINT chk_call_outcome_values
  CHECK (call_outcome IS NULL OR call_outcome IN (
    'connected', 'voicemail', 'no_answer', 'wrong_number', 'callback_requested'
  ));

-- 2. Index for team stats queries (agency + status + due_date)
CREATE INDEX IF NOT EXISTS idx_onboarding_tasks_team_stats
  ON onboarding_tasks (agency_id, status, due_date);

-- 3. RPC: get_sequence_team_stats
--    Returns per-assignee task stats for the team dashboard.
--    Auth: JWT users with has_agency_access().
--    Uses date-based logic (not status-based) because task status
--    is not auto-promoted (pending→due→overdue) by any cron/trigger.
CREATE OR REPLACE FUNCTION get_sequence_team_stats(
  p_agency_id UUID,
  p_date TEXT DEFAULT NULL  -- 'YYYY-MM-DD', defaults to today
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_date DATE;
  v_day_start   TIMESTAMPTZ;
  v_day_end     TIMESTAMPTZ;
  v_result      JSONB;
BEGIN
  -- Auth check: must have agency access
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '28000';
  END IF;

  IF NOT has_agency_access(auth.uid(), p_agency_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '28000';
  END IF;

  v_target_date := COALESCE(p_date::DATE, CURRENT_DATE);
  v_day_start   := (v_target_date::TEXT || 'T00:00:00')::TIMESTAMPTZ;
  v_day_end     := ((v_target_date + 1)::TEXT || 'T00:00:00')::TIMESTAMPTZ;

  WITH task_data AS (
    SELECT
      t.id,
      t.assigned_to_staff_user_id,
      t.assigned_to_user_id,
      t.status,
      t.due_date,
      t.completed_at,
      t.action_type,
      t.call_outcome,
      t.instance_id,
      i.status AS instance_status,
      s.id AS sequence_id,
      s.name AS sequence_name,
      s.target_type AS sequence_type
    FROM onboarding_tasks t
    LEFT JOIN onboarding_instances i ON i.id = t.instance_id
    LEFT JOIN onboarding_sequences s ON s.id = i.sequence_id
    WHERE t.agency_id = p_agency_id
      -- Include active tasks + tasks completed on the target date
      AND (
        t.status IN ('pending', 'due', 'overdue')
        OR (
          t.status = 'completed'
          AND t.completed_at >= v_day_start
          AND t.completed_at < v_day_end
        )
      )
      -- Exclude paused/completed instances (adhoc tasks have no instance)
      AND (i.id IS NULL OR i.status = 'active')
  ),
  -- Aggregate per staff user
  -- Use DATE-based logic, not status-based, for due/overdue classification.
  -- Completion rate denominator = remaining_due + remaining_overdue + completed_today
  -- This stays constant as tasks get completed (no denominator shrinkage).
  staff_stats AS (
    SELECT
      su.id AS member_id,
      su.display_name AS member_name,
      su.username,
      'staff' AS member_type,
      -- Remaining tasks due today (not yet completed)
      COUNT(*) FILTER (WHERE td.due_date = v_target_date AND td.status != 'completed') AS due_today,
      -- Completed on target date
      COUNT(*) FILTER (WHERE td.status = 'completed' AND td.completed_at >= v_day_start AND td.completed_at < v_day_end) AS completed_today,
      -- Remaining overdue (due before today, not completed)
      COUNT(*) FILTER (WHERE td.due_date < v_target_date AND td.status != 'completed') AS overdue,
      -- Upcoming (due after today, not completed)
      COUNT(*) FILTER (WHERE td.due_date > v_target_date AND td.status != 'completed') AS upcoming,
      -- Call outcome breakdown (for tasks completed on target date)
      COUNT(*) FILTER (WHERE td.call_outcome = 'connected') AS calls_connected,
      COUNT(*) FILTER (WHERE td.call_outcome = 'voicemail') AS calls_voicemail,
      COUNT(*) FILTER (WHERE td.call_outcome = 'no_answer') AS calls_no_answer,
      COUNT(*) FILTER (WHERE td.call_outcome = 'wrong_number') AS calls_wrong_number,
      COUNT(*) FILTER (WHERE td.call_outcome = 'callback_requested') AS calls_callback
    FROM staff_users su
    LEFT JOIN task_data td ON td.assigned_to_staff_user_id = su.id
    WHERE su.agency_id = p_agency_id AND su.is_active = TRUE
    GROUP BY su.id, su.display_name, su.username
    HAVING COUNT(td.id) > 0
  ),
  -- Aggregate per profile user (owners, key employees)
  profile_stats AS (
    SELECT
      p.id AS member_id,
      p.full_name AS member_name,
      p.email AS username,
      'user' AS member_type,
      COUNT(*) FILTER (WHERE td.due_date = v_target_date AND td.status != 'completed') AS due_today,
      COUNT(*) FILTER (WHERE td.status = 'completed' AND td.completed_at >= v_day_start AND td.completed_at < v_day_end) AS completed_today,
      COUNT(*) FILTER (WHERE td.due_date < v_target_date AND td.status != 'completed') AS overdue,
      COUNT(*) FILTER (WHERE td.due_date > v_target_date AND td.status != 'completed') AS upcoming,
      COUNT(*) FILTER (WHERE td.call_outcome = 'connected') AS calls_connected,
      COUNT(*) FILTER (WHERE td.call_outcome = 'voicemail') AS calls_voicemail,
      COUNT(*) FILTER (WHERE td.call_outcome = 'no_answer') AS calls_no_answer,
      COUNT(*) FILTER (WHERE td.call_outcome = 'wrong_number') AS calls_wrong_number,
      COUNT(*) FILTER (WHERE td.call_outcome = 'callback_requested') AS calls_callback
    FROM profiles p
    LEFT JOIN task_data td ON td.assigned_to_user_id = p.id
    WHERE p.agency_id = p_agency_id
    GROUP BY p.id, p.full_name, p.email
    HAVING COUNT(td.id) > 0
  ),
  all_stats AS (
    SELECT * FROM staff_stats
    UNION ALL
    SELECT * FROM profile_stats
  ),
  -- Sequence type breakdown
  sequence_breakdown AS (
    SELECT
      COALESCE(td.sequence_type, 'adhoc') AS seq_type,
      COALESCE(td.sequence_name, 'Ad-hoc Tasks') AS seq_name,
      COUNT(*) FILTER (WHERE td.due_date = v_target_date AND td.status != 'completed') AS due_today,
      COUNT(*) FILTER (WHERE td.status = 'completed' AND td.completed_at >= v_day_start AND td.completed_at < v_day_end) AS completed_today,
      COUNT(*) FILTER (WHERE td.due_date < v_target_date AND td.status != 'completed') AS overdue
    FROM task_data td
    GROUP BY COALESCE(td.sequence_type, 'adhoc'), COALESCE(td.sequence_name, 'Ad-hoc Tasks')
  )
  SELECT jsonb_build_object(
    'target_date', v_target_date,
    'team_members', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', a.member_id,
          'name', COALESCE(a.member_name, a.username),
          'type', a.member_type,
          'due_today', a.due_today,
          'completed_today', a.completed_today,
          'overdue', a.overdue,
          'upcoming', a.upcoming,
          'completion_rate', CASE
            WHEN (a.due_today + a.overdue + a.completed_today) > 0
            THEN ROUND((a.completed_today::NUMERIC / (a.due_today + a.overdue + a.completed_today)) * 100)
            ELSE 0
          END,
          'call_outcomes', jsonb_build_object(
            'connected', a.calls_connected,
            'voicemail', a.calls_voicemail,
            'no_answer', a.calls_no_answer,
            'wrong_number', a.calls_wrong_number,
            'callback_requested', a.calls_callback
          )
        )
        ORDER BY a.overdue DESC, (a.due_today + a.overdue) DESC
      )
      FROM all_stats a
    ), '[]'::JSONB),
    'totals', (
      SELECT jsonb_build_object(
        'due_today', COALESCE(SUM(a.due_today), 0),
        'completed_today', COALESCE(SUM(a.completed_today), 0),
        'overdue', COALESCE(SUM(a.overdue), 0),
        'upcoming', COALESCE(SUM(a.upcoming), 0),
        'completion_rate', CASE
          WHEN COALESCE(SUM(a.due_today + a.overdue + a.completed_today), 0) > 0
          THEN ROUND((COALESCE(SUM(a.completed_today), 0)::NUMERIC / COALESCE(SUM(a.due_today + a.overdue + a.completed_today), 0)) * 100)
          ELSE 0
        END
      )
      FROM all_stats a
    ),
    'by_sequence', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'type', sb.seq_type,
          'name', sb.seq_name,
          'due_today', sb.due_today,
          'completed_today', sb.completed_today,
          'overdue', sb.overdue
        )
        ORDER BY sb.overdue DESC, sb.due_today DESC
      )
      FROM sequence_breakdown sb
    ), '[]'::JSONB)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Grant access
REVOKE EXECUTE ON FUNCTION get_sequence_team_stats(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_sequence_team_stats(UUID, TEXT) TO authenticated;
