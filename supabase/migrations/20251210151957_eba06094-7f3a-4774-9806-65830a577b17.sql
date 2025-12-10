-- ====================================
-- SYSTEM-WIDE KPI KEY STANDARDIZATION (NO KPI TABLE CHANGES)
-- ====================================
-- Skip kpis table changes to avoid FK violations
-- Focus on: view aliasing + RPC update + config normalization

-- ====================================
-- STEP 1: Update vw_metrics_with_team to alias columns
-- ====================================
DROP VIEW IF EXISTS public.vw_dashboard_yesterday CASCADE;
DROP VIEW IF EXISTS public.vw_dashboard_weekly CASCADE;
DROP VIEW IF EXISTS public.vw_metrics_with_team CASCADE;

CREATE VIEW public.vw_metrics_with_team AS
SELECT 
    md.id,
    md.agency_id,
    md.team_member_id,
    md.date,
    md.outbound_calls,
    md.talk_minutes,
    -- ALIAS: quoted_count -> quoted_households (standard UI key)
    md.quoted_count AS quoted_households,
    md.quoted_entity,
    -- ALIAS: sold_items -> items_sold (standard UI key)
    md.sold_items AS items_sold,
    md.sold_policies,
    md.sold_premium_cents,
    md.cross_sells_uncovered,
    md.mini_reviews,
    md.final_submission_id,
    md.pass,
    md.daily_score,
    md.streak_count,
    md.created_at,
    md.updated_at,
    md.role,
    md.hits,
    md.is_late,
    md.is_counted_day,
    md.metric_slug,
    md.kpi_version_id,
    md.label_at_submit,
    md.submitted_at,
    tm.name AS rep_name,
    tm.name AS team_member_name
FROM metrics_daily md
LEFT JOIN team_members tm ON tm.id = md.team_member_id;

COMMENT ON VIEW public.vw_metrics_with_team IS 'View aliasing database columns to standard UI keys: sold_items->items_sold, quoted_count->quoted_households';

-- Recreate dependent views
CREATE VIEW public.vw_dashboard_yesterday AS
SELECT * FROM vw_metrics_with_team
WHERE date = (CURRENT_DATE - INTERVAL '1 day')::date;

CREATE VIEW public.vw_dashboard_weekly AS
SELECT 
  agency_id,
  team_member_id,
  team_member_name,
  role,
  SUM(outbound_calls) as outbound_calls,
  SUM(talk_minutes) as talk_minutes,
  SUM(quoted_households) as quoted_households,
  SUM(items_sold) as items_sold,
  SUM(cross_sells_uncovered) as cross_sells_uncovered,
  SUM(mini_reviews) as mini_reviews,
  SUM(daily_score) as weekly_score,
  COUNT(*) FILTER (WHERE is_counted_day) as counted_days
FROM vw_metrics_with_team
WHERE date >= (CURRENT_DATE - INTERVAL '7 day')::date
GROUP BY agency_id, team_member_id, team_member_name, role;

-- ====================================
-- STEP 2: Update get_dashboard_daily RPC to use standard keys
-- ====================================
DROP FUNCTION IF EXISTS public.get_dashboard_daily(text, text, date, date);

CREATE OR REPLACE FUNCTION public.get_dashboard_daily(
  p_agency_slug text,
  p_role text,
  p_start date,
  p_end date
)
RETURNS TABLE (
  team_member_id uuid,
  team_member_name text,
  date date,
  outbound_calls integer,
  talk_minutes integer,
  quoted_households integer,
  items_sold integer,
  cross_sells_uncovered integer,
  mini_reviews integer,
  kpi_version_id uuid,
  label_at_submit text,
  daily_score integer,
  hits integer,
  pass boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  agency_rec record;
  rules_rec record;
BEGIN
  SELECT id INTO agency_rec FROM agencies WHERE slug = p_agency_slug;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agency not found: %', p_agency_slug;
  END IF;
  
  SELECT * INTO rules_rec FROM scorecard_rules 
  WHERE agency_id = agency_rec.id AND role::text = p_role;
  
  IF NOT FOUND THEN
    RAISE NOTICE 'No scorecard rules found for agency % role %', p_agency_slug, p_role;
    RETURN;
  END IF;
  
  RETURN QUERY
  WITH daily_data AS (
    SELECT 
      md.team_member_id,
      tm.name as team_member_name,
      md.date,
      COALESCE(md.outbound_calls, 0) as outbound_calls,
      COALESCE(md.talk_minutes, 0) as talk_minutes,
      COALESCE(md.quoted_count, 0) as quoted_count_internal,
      COALESCE(md.sold_items, 0) as sold_items_internal,
      COALESCE(md.cross_sells_uncovered, 0) as cross_sells_uncovered,
      COALESCE(md.mini_reviews, 0) as mini_reviews,
      md.kpi_version_id,
      md.label_at_submit
    FROM metrics_daily md
    JOIN team_members tm ON tm.id = md.team_member_id
    WHERE md.agency_id = agency_rec.id
      AND (md.role::text = p_role OR md.role::text = 'Hybrid')
      AND md.date BETWEEN p_start AND p_end
  ),
  scored_data AS (
    SELECT 
      dd.*,
      (CASE WHEN dd.outbound_calls >= GREATEST(get_target(agency_rec.id, dd.team_member_id, 'outbound_calls'), 0) THEN 1 ELSE 0 END +
       CASE WHEN dd.talk_minutes >= GREATEST(get_target(agency_rec.id, dd.team_member_id, 'talk_minutes'), 0) THEN 1 ELSE 0 END +
       CASE WHEN dd.quoted_count_internal >= GREATEST(get_target(agency_rec.id, dd.team_member_id, 'quoted_households'), 0) THEN 1 ELSE 0 END +
       CASE WHEN dd.sold_items_internal >= GREATEST(get_target(agency_rec.id, dd.team_member_id, 'items_sold'), 0) THEN 1 ELSE 0 END +
       CASE WHEN dd.cross_sells_uncovered >= GREATEST(get_target(agency_rec.id, dd.team_member_id, 'cross_sells_uncovered'), 0) THEN 1 ELSE 0 END +
       CASE WHEN dd.mini_reviews >= GREATEST(get_target(agency_rec.id, dd.team_member_id, 'mini_reviews'), 0) THEN 1 ELSE 0 END
      ) as hits_count,
      (CASE WHEN dd.outbound_calls >= GREATEST(get_target(agency_rec.id, dd.team_member_id, 'outbound_calls'), 0)
            THEN COALESCE((rules_rec.weights->>'outbound_calls')::integer, 0) ELSE 0 END +
       CASE WHEN dd.talk_minutes >= GREATEST(get_target(agency_rec.id, dd.team_member_id, 'talk_minutes'), 0)
            THEN COALESCE((rules_rec.weights->>'talk_minutes')::integer, 0) ELSE 0 END +
       CASE WHEN dd.quoted_count_internal >= GREATEST(get_target(agency_rec.id, dd.team_member_id, 'quoted_households'), 0)
            THEN COALESCE((rules_rec.weights->>'quoted_households')::integer, 0) ELSE 0 END +
       CASE WHEN dd.sold_items_internal >= GREATEST(get_target(agency_rec.id, dd.team_member_id, 'items_sold'), 0)
            THEN COALESCE((rules_rec.weights->>'items_sold')::integer, 0) ELSE 0 END +
       CASE WHEN dd.cross_sells_uncovered >= GREATEST(get_target(agency_rec.id, dd.team_member_id, 'cross_sells_uncovered'), 0)
            THEN COALESCE((rules_rec.weights->>'cross_sells_uncovered')::integer, 0) ELSE 0 END +
       CASE WHEN dd.mini_reviews >= GREATEST(get_target(agency_rec.id, dd.team_member_id, 'mini_reviews'), 0)
            THEN COALESCE((rules_rec.weights->>'mini_reviews')::integer, 0) ELSE 0 END
      ) as weighted_score
    FROM daily_data dd
  )
  SELECT 
    sd.team_member_id,
    sd.team_member_name,
    sd.date,
    sd.outbound_calls,
    sd.talk_minutes,
    sd.quoted_count_internal AS quoted_households,
    sd.sold_items_internal AS items_sold,
    sd.cross_sells_uncovered,
    sd.mini_reviews,
    sd.kpi_version_id,
    sd.label_at_submit,
    sd.weighted_score as daily_score,
    sd.hits_count as hits,
    (sd.hits_count >= COALESCE(rules_rec.n_required, 2)) as pass
  FROM scored_data sd
  ORDER BY sd.date DESC, sd.team_member_name ASC;
END;
$$;

-- ====================================
-- STEP 3: Normalize scorecard_rules
-- ====================================
UPDATE scorecard_rules
SET ring_metrics = array_replace(
  array_replace(ring_metrics, 'quoted_count', 'quoted_households'),
  'sold_items', 'items_sold'
)
WHERE ring_metrics IS NOT NULL 
  AND (ring_metrics::text LIKE '%quoted_count%' OR ring_metrics::text LIKE '%sold_items%');

UPDATE scorecard_rules
SET selected_metrics = array_replace(
  array_replace(selected_metrics, 'quoted_count', 'quoted_households'),
  'sold_items', 'items_sold'
)
WHERE selected_metrics IS NOT NULL
  AND (selected_metrics::text LIKE '%quoted_count%' OR selected_metrics::text LIKE '%sold_items%');

UPDATE scorecard_rules
SET weights = (
  weights - 'sold_items' - 'quoted_count' ||
  CASE WHEN weights ? 'sold_items' THEN jsonb_build_object('items_sold', weights->'sold_items') ELSE '{}'::jsonb END ||
  CASE WHEN weights ? 'quoted_count' THEN jsonb_build_object('quoted_households', weights->'quoted_count') ELSE '{}'::jsonb END
)
WHERE weights IS NOT NULL 
  AND (weights ? 'sold_items' OR weights ? 'quoted_count');

-- ====================================
-- STEP 4: Normalize targets.metric_key
-- ====================================
UPDATE targets SET metric_key = 'items_sold' WHERE metric_key = 'sold_items';
UPDATE targets SET metric_key = 'quoted_households' WHERE metric_key = 'quoted_count';