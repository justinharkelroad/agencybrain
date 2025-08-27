-- Phase 4: Dashboard SQL views and contest board feature

-- 1.1 Agency flag for contest board
ALTER TABLE agencies
  ADD COLUMN IF NOT EXISTS contest_board_enabled BOOLEAN NOT NULL DEFAULT false;

-- 1.2 Views to simplify dashboard reads

-- Base join
CREATE OR REPLACE VIEW vw_metrics_with_team AS
SELECT
  m.agency_id,
  m.team_member_id,
  tm.name as team_member_name,
  tm.role,
  m.date,
  m.outbound_calls, m.talk_minutes, m.quoted_count, m.quoted_entity,
  m.sold_items, m.sold_policies, m.sold_premium_cents,
  m.cross_sells_uncovered, m.mini_reviews,
  m.pass, m.hits, m.daily_score, m.is_late, m.is_counted_day,
  m.streak_count
FROM metrics_daily m
JOIN team_members tm ON tm.id = m.team_member_id;

-- Yesterday snapshot per agency (convenience)
CREATE OR REPLACE VIEW vw_dashboard_yesterday AS
SELECT *
FROM vw_metrics_with_team
WHERE date = (CURRENT_DATE - INTERVAL '1 day')::date;

-- Weekly window per agency (last 7 days, convenience)
CREATE OR REPLACE VIEW vw_dashboard_weekly AS
SELECT
  agency_id, team_member_id, team_member_name, role,
  MIN(date) as start_date, MAX(date) as end_date,
  SUM(outbound_calls) as outbound_calls,
  SUM(talk_minutes)   as talk_minutes,
  SUM(quoted_count)   as quoted_count,
  SUM(sold_items)     as sold_items,
  SUM(sold_policies)  as sold_policies,
  SUM(sold_premium_cents) as sold_premium_cents,
  SUM(cross_sells_uncovered) as cross_sells_uncovered,
  SUM(mini_reviews) as mini_reviews,
  SUM(CASE WHEN pass THEN 1 ELSE 0 END) as pass_days,
  SUM(daily_score) as weekly_score,
  COUNT(*) FILTER (WHERE is_counted_day) as counted_days
FROM vw_metrics_with_team
WHERE date >= (CURRENT_DATE - INTERVAL '7 day')::date
GROUP BY agency_id, team_member_id, team_member_name, role;

-- 1.3 Optional helper to fetch an agency id from slug
CREATE OR REPLACE FUNCTION get_agency_id_by_slug(p_slug text)
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT id FROM agencies WHERE slug = p_slug LIMIT 1;
$$;

-- 1.4 Optional: fast date-range index
CREATE INDEX IF NOT EXISTS idx_metrics_agency_date ON metrics_daily(agency_id, date DESC);