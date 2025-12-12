-- Drop existing function first, then recreate with correct return type
DROP FUNCTION IF EXISTS public.get_staff_call_scoring_data(uuid, uuid);

CREATE OR REPLACE FUNCTION public.get_staff_call_scoring_data(
  p_agency_id uuid,
  p_team_member_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  templates_arr jsonb;
  team_members_arr jsonb;
  recent_calls_arr jsonb;
  usage_data jsonb;
BEGIN
  -- Fetch templates (global + agency-specific)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', t.id,
    'name', t.name,
    'is_global', t.is_global
  )), '[]'::jsonb)
  INTO templates_arr
  FROM call_scoring_templates t
  WHERE t.is_active = true 
    AND (t.is_global = true OR t.agency_id = p_agency_id);

  -- Fetch team member (staff only sees themselves)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', tm.id,
    'name', tm.name
  )), '[]'::jsonb)
  INTO team_members_arr
  FROM team_members tm
  WHERE tm.id = p_team_member_id;

  -- Fetch recent calls (staff only sees their own)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'original_filename', c.original_filename,
    'call_duration_seconds', c.call_duration_seconds,
    'status', c.status,
    'overall_score', c.overall_score,
    'potential_rank', c.potential_rank,
    'created_at', c.created_at,
    'team_member_name', tm.name
  ) ORDER BY c.created_at DESC), '[]'::jsonb)
  INTO recent_calls_arr
  FROM agency_calls c
  LEFT JOIN team_members tm ON tm.id = c.team_member_id
  WHERE c.agency_id = p_agency_id
    AND c.team_member_id = p_team_member_id;

  -- Fetch usage data
  SELECT jsonb_build_object(
    'calls_used', COALESCE(u.calls_used, 0),
    'calls_limit', COALESCE(s.calls_limit, 20),
    'period_end', u.period_end
  )
  INTO usage_data
  FROM agency_call_scoring_settings s
  LEFT JOIN call_usage_tracking u ON u.agency_id = s.agency_id
    AND now() BETWEEN u.period_start AND u.period_end
  WHERE s.agency_id = p_agency_id;

  -- Build result
  result := jsonb_build_object(
    'templates', templates_arr,
    'team_members', team_members_arr,
    'recent_calls', recent_calls_arr,
    'usage', COALESCE(usage_data, jsonb_build_object('calls_used', 0, 'calls_limit', 20))
  );

  RETURN result;
END;
$$;