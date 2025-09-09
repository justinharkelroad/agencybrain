-- Create function to get versioned dashboard data
CREATE OR REPLACE FUNCTION public.get_versioned_dashboard_data(
  p_agency_slug text,
  p_role text,
  p_consolidate_versions boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  agency_record record;
  result_data jsonb := '{}';
  metrics_data jsonb := '[]';
  tiles_data jsonb := '{}';
  contest_data jsonb := '[]';
BEGIN
  -- Get agency info
  SELECT id, name INTO agency_record 
  FROM agencies 
  WHERE slug = p_agency_slug;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agency not found';
  END IF;

  -- Build metrics with version info
  WITH versioned_metrics AS (
    SELECT 
      md.date,
      md.team_member_id,
      tm.name as team_member_name,
      md.role::text,
      CASE 
        WHEN p_consolidate_versions THEN k.key
        ELSE COALESCE(md.label_at_submit, kv.label, k.label)
      END as kpi_label,
      k.key as kpi_key,
      md.kpi_version_id,
      md.outbound_calls,
      md.talk_minutes,
      md.quoted_count,
      md.sold_items,
      md.sold_policies,
      md.sold_premium_cents,
      md.cross_sells_uncovered,
      md.mini_reviews,
      md.pass,
      md.hits,
      md.daily_score,
      md.is_late,
      md.streak_count
    FROM metrics_daily md
    JOIN team_members tm ON tm.id = md.team_member_id
    LEFT JOIN kpi_versions kv ON kv.id = md.kpi_version_id
    LEFT JOIN kpis k ON k.id = COALESCE(kv.kpi_id, (
      SELECT kpi_id FROM kpi_versions WHERE label = md.label_at_submit LIMIT 1
    ))
    WHERE md.agency_id = agency_record.id
      AND md.role::text = p_role
      AND md.date >= CURRENT_DATE - INTERVAL '7 days'
    ORDER BY md.date DESC
  )
  SELECT jsonb_agg(to_jsonb(vm.*)) INTO metrics_data FROM versioned_metrics vm;

  -- Build tiles (aggregated totals)
  SELECT jsonb_build_object(
    'outbound_calls', COALESCE(SUM(outbound_calls), 0),
    'talk_minutes', COALESCE(SUM(talk_minutes), 0),
    'quoted_count', COALESCE(SUM(quoted_count), 0),
    'sold_items', COALESCE(SUM(sold_items), 0),
    'sold_policies', COALESCE(SUM(sold_policies), 0),
    'sold_premium_cents', COALESCE(SUM(sold_premium_cents), 0),
    'cross_sells_uncovered', COALESCE(SUM(cross_sells_uncovered), 0),
    'mini_reviews', COALESCE(SUM(mini_reviews), 0),
    'pass_rate', CASE WHEN COUNT(*) > 0 THEN COALESCE(SUM(CASE WHEN pass THEN 1 ELSE 0 END)::float / COUNT(*), 0) ELSE 0 END
  ) INTO tiles_data
  FROM metrics_daily md
  WHERE md.agency_id = agency_record.id
    AND md.role::text = p_role
    AND md.date >= CURRENT_DATE - INTERVAL '7 days';

  -- Build contest data (simplified for now)
  SELECT jsonb_agg(jsonb_build_object(
    'team_member_id', team_member_id,
    'team_member_name', team_member_name,
    'total_score', SUM(daily_score),
    'pass_days', SUM(CASE WHEN pass THEN 1 ELSE 0 END),
    'streak', MAX(streak_count)
  ) ORDER BY SUM(daily_score) DESC) INTO contest_data
  FROM (
    SELECT 
      md.team_member_id,
      tm.name as team_member_name,
      md.daily_score,
      md.pass,
      md.streak_count
    FROM metrics_daily md
    JOIN team_members tm ON tm.id = md.team_member_id
    WHERE md.agency_id = agency_record.id
      AND md.role::text = p_role
      AND md.date >= CURRENT_DATE - INTERVAL '7 days'
  ) grouped
  GROUP BY team_member_id, team_member_name;

  -- Build final result
  result_data := jsonb_build_object(
    'metrics', COALESCE(metrics_data, '[]'::jsonb),
    'tiles', COALESCE(tiles_data, '{}'::jsonb),
    'contest', COALESCE(contest_data, '[]'::jsonb)
  );

  RETURN result_data;
END;
$$;