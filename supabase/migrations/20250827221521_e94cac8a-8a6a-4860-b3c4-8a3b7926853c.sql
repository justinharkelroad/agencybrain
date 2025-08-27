-- Complete the database security hardening
-- Fix remaining views that use SECURITY DEFINER

-- Fix views that need to be changed to SECURITY INVOKER or hardened
DROP VIEW IF EXISTS vw_dashboard_yesterday;
CREATE VIEW vw_dashboard_yesterday AS
SELECT 
  md.agency_id,
  md.team_member_id,
  md.role,
  md.date,
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
  md.is_counted_day,
  md.streak_count,
  tm.name as team_member_name,
  md.quoted_entity
FROM metrics_daily md
JOIN team_members tm ON tm.id = md.team_member_id
WHERE md.date = (CURRENT_DATE - INTERVAL '1 day');

DROP VIEW IF EXISTS vw_dashboard_weekly;
CREATE VIEW vw_dashboard_weekly AS
SELECT 
  md.agency_id,
  md.team_member_id,
  md.role,
  date_trunc('week', md.date) as start_date,
  date_trunc('week', md.date) + interval '6 days' as end_date,
  sum(md.outbound_calls) as outbound_calls,
  sum(md.talk_minutes) as talk_minutes,
  sum(md.quoted_count) as quoted_count,
  sum(md.sold_items) as sold_items,
  sum(md.sold_policies) as sold_policies,
  sum(md.sold_premium_cents) as sold_premium_cents,
  sum(md.cross_sells_uncovered) as cross_sells_uncovered,
  sum(md.mini_reviews) as mini_reviews,
  sum(CASE WHEN md.pass THEN 1 ELSE 0 END) as pass_days,
  sum(md.daily_score) as weekly_score,
  sum(CASE WHEN md.is_counted_day THEN 1 ELSE 0 END) as counted_days,
  tm.name as team_member_name
FROM metrics_daily md
JOIN team_members tm ON tm.id = md.team_member_id
WHERE md.date >= date_trunc('week', CURRENT_DATE) - interval '4 weeks'
GROUP BY md.agency_id, md.team_member_id, md.role, date_trunc('week', md.date), tm.name;

-- Set search_path on remaining functions that need it
ALTER FUNCTION public.admin_create_user(text, text, uuid, text, text) SET search_path = public;
ALTER FUNCTION public.check_period_overlap() SET search_path = public;
ALTER FUNCTION public.check_strict_period_overlap() SET search_path = public;
ALTER FUNCTION public.update_period_status() SET search_path = public;
ALTER FUNCTION public.compute_is_late(uuid, jsonb, date, date, timestamptz) SET search_path = public;
ALTER FUNCTION public.get_agency_dates_now(uuid) SET search_path = public;
ALTER FUNCTION public.is_now_agency_time(uuid, text) SET search_path = public;
ALTER FUNCTION public.get_agency_id_by_slug(text) SET search_path = public;
ALTER FUNCTION public.get_team_metrics_for_day(uuid, text, date) SET search_path = public;
ALTER FUNCTION public.recompute_streaks_for_member(uuid, date, date) SET search_path = public;
ALTER FUNCTION public.backfill_metrics_last_n_days(uuid, integer) SET search_path = public;
ALTER FUNCTION public.flatten_quoted_details(uuid) SET search_path = public;
ALTER FUNCTION public.trg_apply_submission() SET search_path = public;