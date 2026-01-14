CREATE OR REPLACE FUNCTION get_staff_call_details(p_call_id UUID, p_team_member_id UUID)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result json;
BEGIN
  SELECT row_to_json(c) INTO result
  FROM (
    SELECT 
      ac.id,
      ac.original_filename,
      ac.call_duration_seconds,
      ac.status,
      ac.overall_score,
      ac.potential_rank,
      ac.skill_scores,
      ac.section_scores,
      ac.discovery_wins,
      ac.critical_gaps,
      ac.closing_attempts,
      ac.missed_signals,
      ac.client_profile,
      ac.premium_analysis,
      ac.coaching_recommendations,
      ac.notable_quotes,
      ac.summary,
      ac.transcript,
      ac.created_at,
      ac.analyzed_at,
      ac.acknowledged_at,
      ac.acknowledged_by,
      ac.staff_feedback_positive,
      ac.staff_feedback_improvement,
      ac.agent_talk_seconds,
      ac.customer_talk_seconds,
      ac.dead_air_seconds,
      ac.agent_talk_percent,
      ac.customer_talk_percent,
      ac.dead_air_percent,
      ac.team_member_id,
      ac.call_type,
      tm.name as team_member_name
    FROM agency_calls ac
    LEFT JOIN team_members tm ON tm.id = ac.team_member_id
    WHERE ac.id = p_call_id
      AND ac.team_member_id = p_team_member_id
  ) c;
  
  RETURN result;
END;
$$;