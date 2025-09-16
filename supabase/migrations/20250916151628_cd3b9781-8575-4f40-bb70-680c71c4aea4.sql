-- Drop and recreate get_dashboard_daily with proper scoring
DROP FUNCTION IF EXISTS public.get_dashboard_daily(text, text, date, date);

CREATE OR REPLACE FUNCTION public.get_dashboard_daily(
  p_agency_slug text,
  p_role text,
  p_start date,
  p_end   date
)
RETURNS TABLE(
  team_member_id uuid,
  team_member_name text,
  date date,
  outbound_calls int,
  talk_minutes int,
  quoted_count int,
  sold_items int,
  cross_sells_uncovered int,
  mini_reviews int,
  kpi_version_id uuid,
  label_at_submit text,
  daily_score int,
  hits int,
  pass boolean
) AS $$
  WITH ag AS (SELECT id FROM agencies WHERE slug = p_agency_slug),
  -- Get scorecard rules for this agency and role
  rules AS (
    SELECT sr.weights, sr.n_required
    FROM scorecard_rules sr
    JOIN ag ON sr.agency_id = ag.id
    WHERE sr.role::text = p_role
    LIMIT 1
  ),
  -- Get base metrics data
  md AS (
    SELECT md.team_member_id, tm.name AS team_member_name, md.date,
           COALESCE(md.outbound_calls,0)        AS outbound_calls,
           COALESCE(md.talk_minutes,0)          AS talk_minutes,
           COALESCE(md.quoted_count,0)          AS quoted_count,
           COALESCE(md.sold_items,0)            AS sold_items,
           COALESCE(md.cross_sells_uncovered,0) AS cross_sells_uncovered,
           COALESCE(md.mini_reviews,0)          AS mini_reviews,
           md.kpi_version_id, md.label_at_submit
    FROM metrics_daily md
    JOIN ag          ON md.agency_id = ag.id
    JOIN team_members tm ON tm.id = md.team_member_id
    WHERE md.role::text = p_role
      AND md.date BETWEEN p_start AND p_end
  ),
  -- Calculate scoring for each team member
  scored AS (
    SELECT md.*,
           -- Calculate hits (number of targets met/exceeded)
           (
             CASE WHEN md.outbound_calls >= COALESCE(
               (SELECT get_target(ag.id, md.team_member_id, 'outbound_calls')), 0
             ) THEN 1 ELSE 0 END +
             CASE WHEN md.talk_minutes >= COALESCE(
               (SELECT get_target(ag.id, md.team_member_id, 'talk_minutes')), 0
             ) THEN 1 ELSE 0 END +
             CASE WHEN md.quoted_count >= COALESCE(
               (SELECT get_target(ag.id, md.team_member_id, 'quoted_count')), 0
             ) THEN 1 ELSE 0 END +
             CASE WHEN md.sold_items >= COALESCE(
               (SELECT get_target(ag.id, md.team_member_id, 'sold_items')), 0
             ) THEN 1 ELSE 0 END +
             CASE WHEN md.cross_sells_uncovered >= COALESCE(
               (SELECT get_target(ag.id, md.team_member_id, 'cross_sells_uncovered')), 0
             ) THEN 1 ELSE 0 END +
             CASE WHEN md.mini_reviews >= COALESCE(
               (SELECT get_target(ag.id, md.team_member_id, 'mini_reviews')), 0
             ) THEN 1 ELSE 0 END
           ) AS hits,
           -- Calculate daily score based on weights for metrics that meet/exceed targets
           (
             CASE WHEN md.outbound_calls >= COALESCE(
               (SELECT get_target(ag.id, md.team_member_id, 'outbound_calls')), 0
             ) THEN COALESCE((rules.weights->>'outbound_calls')::int, 0) ELSE 0 END +
             CASE WHEN md.talk_minutes >= COALESCE(
               (SELECT get_target(ag.id, md.team_member_id, 'talk_minutes')), 0
             ) THEN COALESCE((rules.weights->>'talk_minutes')::int, 0) ELSE 0 END +
             CASE WHEN md.quoted_count >= COALESCE(
               (SELECT get_target(ag.id, md.team_member_id, 'quoted_count')), 0
             ) THEN COALESCE((rules.weights->>'quoted_count')::int, 0) ELSE 0 END +
             CASE WHEN md.sold_items >= COALESCE(
               (SELECT get_target(ag.id, md.team_member_id, 'sold_items')), 0
             ) THEN COALESCE((rules.weights->>'sold_items')::int, 0) ELSE 0 END +
             CASE WHEN md.cross_sells_uncovered >= COALESCE(
               (SELECT get_target(ag.id, md.team_member_id, 'cross_sells_uncovered')), 0
             ) THEN COALESCE((rules.weights->>'cross_sells_uncovered')::int, 0) ELSE 0 END +
             CASE WHEN md.mini_reviews >= COALESCE(
               (SELECT get_target(ag.id, md.team_member_id, 'mini_reviews')), 0
             ) THEN COALESCE((rules.weights->>'mini_reviews')::int, 0) ELSE 0 END
           ) AS daily_score
    FROM md, ag, rules
  )
  SELECT scored.*,
         -- Calculate pass status based on n_required
         (scored.hits >= COALESCE(rules.n_required, 2)) AS pass
  FROM scored, rules
  ORDER BY scored.team_member_name;
$$ LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public;