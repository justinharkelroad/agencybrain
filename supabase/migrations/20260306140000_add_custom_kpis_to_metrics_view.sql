-- Fix: custom_kpis column missing from vw_metrics_with_team view
--
-- Bug: The vw_metrics_with_team view was created (20251210151957) before the
-- custom_kpis JSONB column was added to metrics_daily (20260129100001).
-- The view explicitly lists columns instead of using SELECT *, so custom_kpis
-- was never included.
--
-- Impact: The get_dashboard_daily edge function queries this view with .select('*')
-- and never sees custom_kpis. Any KPI stored in custom_kpis (endorsements_processed,
-- claims_assisted, google_review, inbound_calls, life_appointment_set, todos_completed,
-- walk_in_customer, etc.) shows 0 on the Team Performance Overview dashboard.
--
-- Fix: Recreate the view with custom_kpis included.

-- Drop dependent views first
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
    md.custom_kpis,
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

COMMENT ON VIEW public.vw_metrics_with_team IS 'View aliasing database columns to standard UI keys. Includes custom_kpis JSONB for non-hardcoded KPIs.';

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

-- Also fix get_team_metrics_for_day RPC which is used by TeamRingsGrid page.
-- It was created before custom_kpis existed and never updated.
DROP FUNCTION IF EXISTS public.get_team_metrics_for_day(uuid, text, date);

CREATE OR REPLACE FUNCTION public.get_team_metrics_for_day(p_agency uuid, p_role text, p_date date)
RETURNS TABLE (
  team_member_id uuid,
  name text,
  role text,
  date date,
  outbound_calls int,
  talk_minutes int,
  quoted_count int,
  quoted_entity text,
  sold_items int,
  sold_policies int,
  sold_premium_cents int,
  cross_sells_uncovered int,
  mini_reviews int,
  custom_kpis jsonb
) LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT tm.id, tm.name, tm.role::text, p_date,
         coalesce(md.outbound_calls,0), coalesce(md.talk_minutes,0), coalesce(md.quoted_count,0), md.quoted_entity,
         coalesce(md.sold_items,0), coalesce(md.sold_policies,0), coalesce(md.sold_premium_cents,0),
         coalesce(md.cross_sells_uncovered,0), coalesce(md.mini_reviews,0),
         coalesce(md.custom_kpis, '{}'::jsonb)
  FROM team_members tm
  LEFT JOIN metrics_daily md
    ON md.team_member_id = tm.id AND md.date = p_date
  WHERE tm.agency_id = p_agency
    AND tm.role::text = p_role
    AND tm.status = 'active'
  ORDER BY tm.name ASC;
$$;

-- Force PostgREST to pick up the new return type immediately
NOTIFY pgrst, 'reload schema';
