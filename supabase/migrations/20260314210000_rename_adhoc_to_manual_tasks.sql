-- Rename "Ad-hoc Tasks" → "Manual Tasks" in the team stats RPC display label.
-- The function body is identical to 20260314200000 except for this string.
CREATE OR REPLACE FUNCTION get_sequence_team_stats(
  p_agency_id UUID,
  p_date TEXT DEFAULT NULL
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
      t.id, t.assigned_to_staff_user_id, t.assigned_to_user_id, t.status,
      t.due_date, t.completed_at, t.action_type, t.call_outcome, t.instance_id,
      i.status AS instance_status, s.id AS sequence_id, s.name AS sequence_name,
      s.target_type AS sequence_type
    FROM onboarding_tasks t
    LEFT JOIN onboarding_instances i ON i.id = t.instance_id
    LEFT JOIN onboarding_sequences s ON s.id = i.sequence_id
    WHERE t.agency_id = p_agency_id
      AND (
        t.status IN ('pending', 'due', 'overdue')
        OR (t.status = 'completed' AND t.completed_at >= v_day_start AND t.completed_at < v_day_end)
      )
      AND (i.id IS NULL OR i.status = 'active')
  ),
  staff_stats AS (
    SELECT
      su.id AS member_id, su.display_name AS member_name, su.username, 'staff' AS member_type,
      COUNT(*) FILTER (WHERE td.due_date = v_target_date AND td.status != 'completed') AS due_today,
      COUNT(*) FILTER (WHERE td.status = 'completed' AND td.completed_at >= v_day_start AND td.completed_at < v_day_end) AS completed_today,
      COUNT(*) FILTER (WHERE td.due_date < v_target_date AND td.status != 'completed') AS overdue,
      COUNT(*) FILTER (WHERE td.due_date > v_target_date AND td.status != 'completed') AS upcoming,
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
  profile_stats AS (
    SELECT
      p.id AS member_id, p.full_name AS member_name, p.email AS username, 'user' AS member_type,
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
    SELECT * FROM staff_stats UNION ALL SELECT * FROM profile_stats
  ),
  sequence_breakdown AS (
    SELECT
      COALESCE(td.sequence_type, 'adhoc') AS seq_type,
      COALESCE(td.sequence_name, 'Manual Tasks') AS seq_name,
      COUNT(*) FILTER (WHERE td.due_date = v_target_date AND td.status != 'completed') AS due_today,
      COUNT(*) FILTER (WHERE td.status = 'completed' AND td.completed_at >= v_day_start AND td.completed_at < v_day_end) AS completed_today,
      COUNT(*) FILTER (WHERE td.due_date < v_target_date AND td.status != 'completed') AS overdue
    FROM task_data td
    GROUP BY COALESCE(td.sequence_type, 'adhoc'), COALESCE(td.sequence_name, 'Manual Tasks')
  )
  SELECT jsonb_build_object(
    'target_date', v_target_date,
    'team_members', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', a.member_id, 'name', COALESCE(a.member_name, a.username), 'type', a.member_type,
          'due_today', a.due_today, 'completed_today', a.completed_today, 'overdue', a.overdue,
          'upcoming', a.upcoming,
          'completion_rate', CASE
            WHEN (a.due_today + a.overdue + a.completed_today) > 0
            THEN ROUND((a.completed_today::NUMERIC / (a.due_today + a.overdue + a.completed_today)) * 100)
            ELSE 0
          END,
          'call_outcomes', jsonb_build_object(
            'connected', a.calls_connected, 'voicemail', a.calls_voicemail,
            'no_answer', a.calls_no_answer, 'wrong_number', a.calls_wrong_number,
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
          'type', sb.seq_type, 'name', sb.seq_name, 'due_today', sb.due_today,
          'completed_today', sb.completed_today, 'overdue', sb.overdue
        )
        ORDER BY sb.overdue DESC, sb.due_today DESC
      )
      FROM sequence_breakdown sb
    ), '[]'::JSONB)
  ) INTO v_result;

  RETURN v_result;
END;
$$;
