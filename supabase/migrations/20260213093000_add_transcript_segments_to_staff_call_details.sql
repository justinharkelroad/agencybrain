-- Ensure manager/staff call detail RPC returns transcript_segments for timestamped QA workflows
DROP FUNCTION IF EXISTS public.get_staff_call_details(uuid, uuid, uuid, text);

CREATE OR REPLACE FUNCTION public.get_staff_call_details(
  p_call_id uuid,
  p_team_member_id uuid DEFAULT NULL,
  p_agency_id uuid DEFAULT NULL,
  p_staff_session_token text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
  v_staff_team_member_id uuid;
  v_is_staff_manager boolean := false;
  v_effective_team_member_id uuid;
  v_authorized_agency_id uuid;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF p_agency_id IS NOT NULL THEN
      v_authorized_agency_id := p_agency_id;
    ELSE
      SELECT ac.agency_id INTO v_authorized_agency_id
      FROM public.agency_calls ac
      WHERE ac.id = p_call_id;
    END IF;

    IF v_authorized_agency_id IS NULL OR NOT public.has_agency_access(auth.uid(), v_authorized_agency_id) THEN
      RAISE EXCEPTION 'unauthorized' USING ERRCODE = '28000';
    END IF;

    v_effective_team_member_id := p_team_member_id;
  ELSIF p_staff_session_token IS NOT NULL THEN
    IF p_agency_id IS NOT NULL THEN
      v_authorized_agency_id := p_agency_id;
    ELSE
      SELECT ac.agency_id INTO v_authorized_agency_id
      FROM public.agency_calls ac
      WHERE ac.id = p_call_id;
    END IF;

    v_staff_team_member_id := public.verify_staff_session(p_staff_session_token, v_authorized_agency_id);
    IF v_staff_team_member_id IS NULL THEN
      RAISE EXCEPTION 'unauthorized' USING ERRCODE = '28000';
    END IF;

    SELECT lower(coalesce(tm.role::text, '')) IN ('manager', 'owner')
    INTO v_is_staff_manager
    FROM public.team_members tm
    WHERE tm.id = v_staff_team_member_id
    LIMIT 1;

    IF p_team_member_id IS NULL THEN
      v_effective_team_member_id := CASE WHEN v_is_staff_manager THEN NULL ELSE v_staff_team_member_id END;
    ELSE
      IF p_team_member_id <> v_staff_team_member_id AND NOT v_is_staff_manager THEN
        RAISE EXCEPTION 'unauthorized' USING ERRCODE = '28000';
      END IF;
      v_effective_team_member_id := p_team_member_id;
    END IF;
  ELSE
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '28000';
  END IF;

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
      ac.transcript_segments,
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
    FROM public.agency_calls ac
    LEFT JOIN public.team_members tm ON tm.id = ac.team_member_id
    WHERE ac.id = p_call_id
      AND ac.agency_id = v_authorized_agency_id
      AND (
        auth.uid() IS NOT NULL
        OR v_effective_team_member_id IS NULL
        OR ac.team_member_id = v_effective_team_member_id
      )
  ) c;

  RETURN result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_staff_call_details(uuid, uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_staff_call_details(uuid, uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_staff_call_details(uuid, uuid, uuid, text) TO anon;
