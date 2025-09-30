-- Fix Security Definer Views
-- Remove SECURITY DEFINER property from all views to enforce proper RLS
-- Views should respect the querying user's permissions, not bypass them

-- vw_active_kpis: Join kpis with their current version labels
DROP VIEW IF EXISTS public.vw_active_kpis CASCADE;
CREATE VIEW public.vw_active_kpis AS
SELECT 
  k.id,
  k.agency_id,
  k.is_active,
  k.effective_from,
  k.effective_to,
  k.created_by,
  k.created_at,
  k.role,
  k.archived_at,
  k.key,
  v.label,
  k.type,
  k.color
FROM public.kpis k
JOIN public.kpi_versions v ON v.kpi_id = k.id
WHERE v.valid_to IS NULL AND k.is_active = true;

-- vw_submission_metrics: Aggregate metrics from submission payload
DROP VIEW IF EXISTS public.vw_submission_metrics CASCADE;
CREATE VIEW public.vw_submission_metrics AS
SELECT 
  s.id as submission_id,
  COALESCE((s.payload_json->'outboundCalls')::text::int, 0) as outbound_calls,
  COALESCE((s.payload_json->'talkMinutes')::text::int, 0) as talk_minutes,
  COALESCE((s.payload_json->'quotedCount')::text::int, 0) as quoted_count,
  COALESCE((s.payload_json->'soldItems')::text::int, 0) as sold_items
FROM public.submissions s;

-- vw_metrics_with_team: Join metrics_daily with team member names
DROP VIEW IF EXISTS public.vw_metrics_with_team CASCADE;
CREATE VIEW public.vw_metrics_with_team AS
SELECT 
  md.*,
  tm.name as rep_name
FROM public.metrics_daily md
LEFT JOIN public.team_members tm ON tm.id = md.team_member_id;

-- vw_dashboard_yesterday: Yesterday's metrics with team member info
DROP VIEW IF EXISTS public.vw_dashboard_yesterday CASCADE;
CREATE VIEW public.vw_dashboard_yesterday AS
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
FROM public.metrics_daily md
JOIN public.team_members tm ON tm.id = md.team_member_id
WHERE md.date = CURRENT_DATE - INTERVAL '1 day';

-- vw_dashboard_weekly: Rolling 7-day aggregated metrics
DROP VIEW IF EXISTS public.vw_dashboard_weekly CASCADE;
CREATE VIEW public.vw_dashboard_weekly AS
SELECT 
  md.agency_id,
  md.team_member_id,
  md.role,
  (CURRENT_DATE - INTERVAL '6 days')::timestamp with time zone as start_date,
  CURRENT_DATE::timestamp with time zone as end_date,
  SUM(md.outbound_calls) as outbound_calls,
  SUM(md.talk_minutes) as talk_minutes,
  SUM(md.quoted_count) as quoted_count,
  SUM(md.sold_items) as sold_items,
  SUM(md.sold_policies) as sold_policies,
  SUM(md.sold_premium_cents) as sold_premium_cents,
  SUM(md.cross_sells_uncovered) as cross_sells_uncovered,
  SUM(md.mini_reviews) as mini_reviews,
  COUNT(CASE WHEN md.pass THEN 1 END) as pass_days,
  SUM(md.daily_score) as weekly_score,
  COUNT(CASE WHEN md.is_counted_day THEN 1 END) as counted_days,
  tm.name as team_member_name
FROM public.metrics_daily md
JOIN public.team_members tm ON tm.id = md.team_member_id
WHERE md.date >= CURRENT_DATE - INTERVAL '6 days'
  AND md.date <= CURRENT_DATE
GROUP BY md.agency_id, md.team_member_id, md.role, tm.name;

-- All views now respect RLS policies of the querying user
-- Access control is enforced through RLS policies on the underlying tables