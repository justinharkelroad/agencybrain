-- GATE 4: Drop and recreate get_versioned_dashboard_data RPC
-- Returns dashboard data with label_at_submit preferences

DROP FUNCTION IF EXISTS public.get_versioned_dashboard_data(text, text, boolean);

CREATE OR REPLACE FUNCTION public.get_versioned_dashboard_data(
  p_agency_slug text,
  p_role text,
  p_consolidate_versions boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  agency_uuid uuid;
  result jsonb;
  metrics jsonb;
  tiles jsonb;
  contest jsonb;
BEGIN
  -- Get agency ID from slug
  SELECT id INTO agency_uuid FROM agencies WHERE slug = p_agency_slug;
  
  IF agency_uuid IS NULL THEN
    RAISE EXCEPTION 'Agency not found for slug: %', p_agency_slug;
  END IF;
  
  -- Verify user has access to this agency
  IF NOT has_agency_access(auth.uid(), agency_uuid) THEN
    RAISE EXCEPTION 'Access denied to agency data';
  END IF;
  
  -- Build metrics array with label_at_submit (latest wins)
  WITH daily_metrics AS (
    SELECT 
      md.date::text,
      md.team_member_id::text,
      tm.name as team_member_name,
      md.role::text,
      k.key as kpi_key,
      COALESCE(md.label_at_submit, kv.label) as kpi_label, -- label_at_submit wins
      md.kpi_version_id::text,
      COALESCE(md.outbound_calls, 0) + COALESCE(md.talk_minutes, 0) + 
      COALESCE(md.quoted_count, 0) + COALESCE(md.sold_items, 0) as value,
      COALESCE(md.pass, false) as pass,
      COALESCE(md.hits, 0) as hits,
      COALESCE(md.daily_score, 0) as daily_score,
      COALESCE(md.is_late, false) as is_late,
      COALESCE(md.streak_count, 0) as streak_count
    FROM metrics_daily md
    JOIN team_members tm ON tm.id = md.team_member_id
    LEFT JOIN kpi_versions kv ON kv.id = md.kpi_version_id
    LEFT JOIN kpis k ON k.id = kv.kpi_id
    WHERE md.agency_id = agency_uuid
      AND md.role::text = p_role
      AND md.date >= CURRENT_DATE - INTERVAL '7 days'
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'date', date,
      'team_member_id', team_member_id,
      'team_member_name', team_member_name,
      'role', role,
      'kpi_key', kpi_key,
      'kpi_label', kpi_label,
      'kpi_version_id', kpi_version_id,
      'value', value,
      'pass', pass,
      'hits', hits,
      'daily_score', daily_score,
      'is_late', is_late,
      'streak_count', streak_count
    )
  ) INTO metrics
  FROM daily_metrics;
  
  -- Build tiles (aggregate totals)
  WITH tile_data AS (
    SELECT 
      SUM(COALESCE(md.outbound_calls, 0)) as outbound_calls,
      SUM(COALESCE(md.talk_minutes, 0)) as talk_minutes,
      SUM(COALESCE(md.quoted_count, 0)) as quoted,
      SUM(COALESCE(md.sold_items, 0)) as sold_items,
      SUM(COALESCE(md.sold_policies, 0)) as sold_policies,
      SUM(COALESCE(md.sold_premium_cents, 0)) as sold_premium_cents,
      ROUND(AVG(CASE WHEN md.pass THEN 100.0 ELSE 0.0 END), 1) as pass_rate,
      SUM(COALESCE(md.cross_sells_uncovered, 0)) as cross_sells_uncovered,
      SUM(COALESCE(md.mini_reviews, 0)) as mini_reviews
    FROM metrics_daily md
    WHERE md.agency_id = agency_uuid
      AND md.role::text = p_role
      AND md.date >= CURRENT_DATE - INTERVAL '7 days'
  )
  SELECT jsonb_build_object(
    'outbound_calls', outbound_calls,
    'talk_minutes', talk_minutes,
    'quoted', quoted,
    'sold_items', sold_items,
    'sold_policies', sold_policies,
    'sold_premium_cents', sold_premium_cents,
    'pass_rate', pass_rate,
    'cross_sells_uncovered', cross_sells_uncovered,
    'mini_reviews', mini_reviews
  ) INTO tiles
  FROM tile_data;
  
  -- Build contest array (empty for now)
  contest := '[]'::jsonb;
  
  -- Return combined result
  result := jsonb_build_object(
    'metrics', COALESCE(metrics, '[]'::jsonb),
    'tiles', COALESCE(tiles, '{}'::jsonb),
    'contest', contest
  );
  
  RETURN result;
END;
$function$;