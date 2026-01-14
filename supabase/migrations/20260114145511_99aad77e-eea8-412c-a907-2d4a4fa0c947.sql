-- Drop the unused 2-argument overload first
DROP FUNCTION IF EXISTS public.get_staff_call_scoring_data(uuid, uuid);

-- Update the 4-argument function to include template_id and template_name in analytics_calls
CREATE OR REPLACE FUNCTION public.get_staff_call_scoring_data(
  p_agency_id uuid,
  p_team_member_id uuid DEFAULT NULL::uuid,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 10
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_offset integer;
  v_result json;
BEGIN
  v_offset := (p_page - 1) * p_page_size;

  SELECT json_build_object(
    'calls', COALESCE((
      SELECT json_agg(row_to_json(c))
      FROM (
        SELECT 
          ac.id,
          ac.team_member_id,
          tm.name as team_member_name,
          ac.template_id,
          cst.name as template_name,
          ac.original_filename,
          ac.overall_score,
          ac.potential_rank,
          ac.summary,
          ac.skill_scores,
          ac.section_scores,
          ac.discovery_wins,
          ac.critical_gaps,
          ac.coaching_recommendations,
          ac.notable_quotes,
          ac.closing_attempts,
          ac.missed_signals,
          ac.client_profile,
          ac.call_duration_seconds,
          ac.agent_talk_percent,
          ac.customer_talk_percent,
          ac.dead_air_percent,
          ac.call_type,
          ac.transcript,
          ac.transcript_segments,
          ac.created_at,
          ac.analyzed_at,
          ac.status,
          ac.acknowledged_at,
          ac.acknowledged_by,
          ac.staff_feedback_positive,
          ac.staff_feedback_improvement,
          ac.premium_analysis
        FROM agency_calls ac
        LEFT JOIN team_members tm ON tm.id = ac.team_member_id
        LEFT JOIN call_scoring_templates cst ON cst.id = ac.template_id
        WHERE ac.agency_id = p_agency_id
          AND (p_team_member_id IS NULL OR ac.team_member_id = p_team_member_id)
        ORDER BY ac.created_at DESC
        LIMIT p_page_size OFFSET v_offset
      ) c
    ), '[]'::json),
    'total_count', (
      SELECT COUNT(*)::integer
      FROM agency_calls ac
      WHERE ac.agency_id = p_agency_id
        AND (p_team_member_id IS NULL OR ac.team_member_id = p_team_member_id)
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
  ) INTO v_result;

  RETURN v_result;
END;
$function$;