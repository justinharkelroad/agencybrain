CREATE OR REPLACE FUNCTION get_staff_call_scoring_data(
  p_agency_id uuid,
  p_team_member_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'recent_calls', COALESCE((
      SELECT json_agg(row_to_json(rc))
      FROM (
        SELECT 
          ac.id,
          ac.team_member_id,
          tm.name as team_member_name,
          ac.original_filename,
          ac.status,
          ac.overall_score,
          ac.potential_rank,
          ac.summary,
          ac.skill_scores,
          ac.section_scores,
          ac.discovery_wins,
          ac.critical_gaps,
          ac.coaching_recommendations,
          ac.notable_quotes,
          ac.transcript,
          ac.transcript_segments,
          ac.call_duration_seconds,
          ac.agent_talk_percent,
          ac.customer_talk_percent,
          ac.dead_air_percent,
          ac.created_at,
          ac.analyzed_at,
          ac.call_type,
          ac.template_id,
          cst.name as template_name,
          ac.closing_attempts,
          ac.missed_signals,
          ac.conversion_required,
          ac.conversion_attempts,
          ac.client_profile,
          ac.premium_analysis,
          ac.staff_feedback_positive,
          ac.staff_feedback_improvement,
          ac.acknowledged_at,
          ac.acknowledged_by
        FROM agency_calls ac
        LEFT JOIN team_members tm ON tm.id = ac.team_member_id
        LEFT JOIN call_scoring_templates cst ON cst.id = ac.template_id
        WHERE ac.agency_id = p_agency_id
          AND (p_team_member_id IS NULL OR ac.team_member_id = p_team_member_id)
        ORDER BY ac.created_at DESC
        LIMIT 50
      ) rc
    ), '[]'::json),
    
    'templates', COALESCE((
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT 
          cst.id,
          cst.name,
          cst.description,
          cst.call_type,
          cst.is_active,
          cst.skill_categories
        FROM call_scoring_templates cst
        WHERE cst.is_active = true
          AND (cst.is_global = true OR cst.agency_id = p_agency_id)
        ORDER BY cst.name
      ) t
    ), '[]'::json),
    
    'team_members', COALESCE((
      SELECT json_agg(row_to_json(tm))
      FROM (
        SELECT 
          tm.id,
          tm.name,
          tm.email,
          tm.is_active
        FROM team_members tm
        WHERE tm.agency_id = p_agency_id
          AND tm.is_active = true
        ORDER BY tm.name
      ) tm
    ), '[]'::json),
    
    'usage', (
      SELECT row_to_json(u)
      FROM (
        SELECT 
          COALESCE(cut.calls_used, 0) as calls_used,
          COALESCE(acss.calls_limit, 10) as calls_limit,
          acss.enabled,
          acss.reset_day
        FROM agency_call_scoring_settings acss
        LEFT JOIN call_usage_tracking cut ON cut.agency_id = acss.agency_id
          AND cut.billing_period_start <= CURRENT_DATE
          AND cut.billing_period_end >= CURRENT_DATE
        WHERE acss.agency_id = p_agency_id
      ) u
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