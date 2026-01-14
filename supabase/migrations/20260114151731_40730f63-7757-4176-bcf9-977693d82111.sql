-- Restore complete get_staff_call_scoring_data function (broken by migration 20260114145511)
-- This restores all original sections and adds template_id/template_name to analytics_calls only

CREATE OR REPLACE FUNCTION get_staff_call_scoring_data(
  p_agency_id UUID,
  p_team_member_id UUID DEFAULT NULL,
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 10
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result json;
  v_offset INT;
  v_total_calls INT;
BEGIN
  v_offset := (p_page - 1) * p_page_size;
  
  SELECT COUNT(*) INTO v_total_calls
  FROM agency_calls
  WHERE agency_id = p_agency_id
    AND (p_team_member_id IS NULL OR team_member_id = p_team_member_id);

  SELECT json_build_object(
    'recent_calls', COALESCE((
      SELECT json_agg(row_to_json(c))
      FROM (
        SELECT 
          ac.id,
          ac.team_member_id,
          tm.name as team_member_name,
          ac.template_id,
          cst.name as template_name,
          ac.original_filename,
          ac.status,
          ac.overall_score,
          ac.potential_rank,
          ac.summary,
          ac.created_at,
          ac.analyzed_at,
          ac.call_type,
          ac.call_duration_seconds,
          ac.agent_talk_percent,
          ac.customer_talk_percent,
          ac.dead_air_percent,
          ac.acknowledged_at,
          ac.acknowledged_by,
          ac.staff_feedback_positive,
          ac.staff_feedback_improvement,
          ac.skill_scores,
          ac.section_scores,
          ac.client_profile,
          ac.discovery_wins,
          ac.critical_gaps,
          ac.closing_attempts,
          ac.missed_signals,
          ac.coaching_recommendations,
          ac.notable_quotes,
          ac.premium_analysis,
          ac.agent_talk_seconds,
          ac.customer_talk_seconds,
          ac.dead_air_seconds
        FROM agency_calls ac
        LEFT JOIN team_members tm ON tm.id = ac.team_member_id
        LEFT JOIN call_scoring_templates cst ON cst.id = ac.template_id
        WHERE ac.agency_id = p_agency_id
          AND (p_team_member_id IS NULL OR ac.team_member_id = p_team_member_id)
        ORDER BY ac.created_at DESC
        LIMIT p_page_size OFFSET v_offset
      ) c
    ), '[]'::json),
    'total_calls', v_total_calls,
    'team_members', COALESCE((
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT id, name, role
        FROM team_members
        WHERE agency_id = p_agency_id
          AND status = 'active'
          AND (p_team_member_id IS NULL OR id = p_team_member_id)
        ORDER BY name
      ) t
    ), '[]'::json),
    'templates', COALESCE((
      SELECT json_agg(row_to_json(tpl))
      FROM (
        SELECT id, name, description, call_type
        FROM call_scoring_templates
        WHERE (agency_id = p_agency_id OR is_global = true)
          AND is_active = true
        ORDER BY name
      ) tpl
    ), '[]'::json),
    'usage', (
      SELECT json_build_object(
        'calls_used', COALESCE(cut.calls_used, 0),
        'calls_limit', COALESCE(acss.calls_limit, 20)
      )
      FROM agency_call_scoring_settings acss
      LEFT JOIN call_usage_tracking cut ON cut.agency_id = acss.agency_id
        AND cut.period_start <= CURRENT_DATE
        AND cut.period_end >= CURRENT_DATE
      WHERE acss.agency_id = p_agency_id
      LIMIT 1
    ),
    'analytics_calls', COALESCE((
      SELECT json_agg(row_to_json(a))
      FROM (
        SELECT 
          ac.id,
          ac.team_member_id,
          tm.name as team_member_name,
          ac.template_id,
          cst.name as template_name,
          ac.potential_rank,
          ac.overall_score,
          ac.skill_scores,
          ac.discovery_wins,
          ac.analyzed_at,
          ac.call_type
        FROM agency_calls ac
        LEFT JOIN team_members tm ON tm.id = ac.team_member_id
        LEFT JOIN call_scoring_templates cst ON cst.id = ac.template_id
        WHERE ac.agency_id = p_agency_id
          AND (p_team_member_id IS NULL OR ac.team_member_id = p_team_member_id)
          AND ac.analyzed_at IS NOT NULL
        ORDER BY ac.analyzed_at DESC
      ) a
    ), '[]'::json)
  ) INTO result;
  
  RETURN result;
END;
$$;