-- Update get_dashboard_daily to exclude team members with include_in_metrics = false

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
  custom_kpis jsonb,
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
      COALESCE(md.custom_kpis, '{}'::jsonb) as custom_kpis,
      md.kpi_version_id,
      md.label_at_submit
    FROM metrics_daily md
    JOIN team_members tm ON tm.id = md.team_member_id
      AND tm.include_in_metrics = true
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
    sd.custom_kpis,
    sd.kpi_version_id,
    sd.label_at_submit,
    sd.weighted_score as daily_score,
    sd.hits_count as hits,
    (sd.hits_count >= COALESCE(rules_rec.n_required, 2)) as pass
  FROM scored_data sd
  ORDER BY sd.date DESC, sd.team_member_name ASC;
END;
$$;
