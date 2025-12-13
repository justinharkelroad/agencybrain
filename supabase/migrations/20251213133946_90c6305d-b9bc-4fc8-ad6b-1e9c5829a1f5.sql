CREATE OR REPLACE FUNCTION public.get_staff_call_scoring_data(p_agency_id uuid, p_team_member_id uuid DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'recent_calls', COALESCE((
      SELECT json_agg(row_to_json(c))
      FROM (
        SELECT 
          ac.id,
          ac.team_member_id,
          ac.template_id,
          ac.original_filename,
          ac.call_duration_seconds,
          ac.status,
          ac.overall_score,
          ac.potential_rank,
          ac.summary,
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
          ac.created_at,
          ac.analyzed_at,
          tm.name as team_member_name,
          cst.name as template_name
        FROM agency_calls ac
        LEFT JOIN team_members tm ON tm.id = ac.team_member_id
        LEFT JOIN call_scoring_templates cst ON cst.id = ac.template_id
        WHERE ac.agency_id = p_agency_id
          AND (p_team_member_id IS NULL OR ac.team_member_id = p_team_member_id)
        ORDER BY ac.created_at DESC
        LIMIT 50
      ) c
    ), '[]'::json),
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
        SELECT id, name, description
        FROM call_scoring_templates
        WHERE is_active = true
          AND (is_global = true OR agency_id IS NULL OR agency_id = p_agency_id)
        ORDER BY name
      ) tpl
    ), '[]'::json),
    'usage', (
      SELECT row_to_json(u)
      FROM (
        SELECT 
          COALESCE(cut.calls_used, 0) as calls_used,
          COALESCE(acss.calls_limit, 20) as calls_limit,
          cut.period_start,
          cut.period_end
        FROM agency_call_scoring_settings acss
        LEFT JOIN call_usage_tracking cut ON cut.agency_id = acss.agency_id
          AND cut.period_start <= CURRENT_DATE
          AND cut.period_end >= CURRENT_DATE
        WHERE acss.agency_id = p_agency_id
        LIMIT 1
      ) u
    )
  ) INTO result;
  
  RETURN result;
END;
$function$;