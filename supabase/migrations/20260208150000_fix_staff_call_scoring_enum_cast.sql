-- Fix enum/text coercion in staff call-scoring RPC auth paths.
-- Prevents "invalid input value for enum app_member_status: \"\"" errors.

CREATE OR REPLACE FUNCTION public.verify_staff_session(
  p_token text,
  p_agency_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_member_id uuid;
BEGIN
  IF p_token IS NULL OR btrim(p_token) = '' OR p_agency_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT su.team_member_id
  INTO v_team_member_id
  FROM public.staff_sessions ss
  JOIN public.staff_users su ON su.id = ss.staff_user_id
  JOIN public.team_members tm ON tm.id = su.team_member_id
  WHERE ss.session_token = p_token
    AND ss.is_valid = true
    AND ss.expires_at > now()
    AND su.is_active = true
    AND su.agency_id = p_agency_id
    AND tm.agency_id = p_agency_id
    AND lower(coalesce(tm.status::text, '')) = 'active'
  LIMIT 1;

  RETURN v_team_member_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_staff_call_scoring_data(
  p_agency_id uuid,
  p_team_member_id uuid DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 10,
  p_staff_session_token text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
  v_offset integer;
  v_total_calls integer;
  v_staff_team_member_id uuid;
  v_effective_team_member_id uuid;
  v_is_staff_manager boolean := false;
BEGIN
  IF p_agency_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '28000';
  END IF;

  IF auth.uid() IS NOT NULL THEN
    IF NOT public.has_agency_access(auth.uid(), p_agency_id) THEN
      RAISE EXCEPTION 'unauthorized' USING ERRCODE = '28000';
    END IF;
    v_effective_team_member_id := p_team_member_id;
  ELSIF p_staff_session_token IS NOT NULL THEN
    v_staff_team_member_id := public.verify_staff_session(p_staff_session_token, p_agency_id);
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

  v_offset := GREATEST((COALESCE(p_page, 1) - 1) * GREATEST(COALESCE(p_page_size, 10), 1), 0);

  SELECT COUNT(*) INTO v_total_calls
  FROM public.agency_calls ac
  WHERE ac.agency_id = p_agency_id
    AND (v_effective_team_member_id IS NULL OR ac.team_member_id = v_effective_team_member_id);

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
          ac.call_type,
          tm.name as team_member_name,
          cst.name as template_name
        FROM public.agency_calls ac
        LEFT JOIN public.team_members tm ON tm.id = ac.team_member_id
        LEFT JOIN public.call_scoring_templates cst ON cst.id = ac.template_id
        WHERE ac.agency_id = p_agency_id
          AND (v_effective_team_member_id IS NULL OR ac.team_member_id = v_effective_team_member_id)
        ORDER BY ac.created_at DESC
        LIMIT GREATEST(COALESCE(p_page_size, 10), 1)
        OFFSET v_offset
      ) c
    ), '[]'::json),
    'total_calls', v_total_calls,
    'team_members', COALESCE((
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT id, name, role
        FROM public.team_members
        WHERE agency_id = p_agency_id
          AND lower(coalesce(status::text, '')) = 'active'
          AND include_in_metrics = true
          AND (v_effective_team_member_id IS NULL OR id = v_effective_team_member_id)
        ORDER BY name
      ) t
    ), '[]'::json),
    'templates', COALESCE((
      SELECT json_agg(row_to_json(tpl))
      FROM (
        SELECT id, name, description
        FROM public.call_scoring_templates
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
        FROM public.agency_call_scoring_settings acss
        LEFT JOIN public.call_usage_tracking cut ON cut.agency_id = acss.agency_id
          AND cut.period_start <= CURRENT_DATE
          AND cut.period_end >= CURRENT_DATE
        WHERE acss.agency_id = p_agency_id
        LIMIT 1
      ) u
    )
  ) INTO result;

  RETURN result;
END;
$$;
