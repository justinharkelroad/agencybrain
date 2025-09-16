-- Fix the search path security issue for get_dashboard_daily function
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
  kpi_version_id uuid,
  label_at_submit text
) AS $$
  WITH ag AS (SELECT id FROM agencies WHERE slug = p_agency_slug),
  md AS (
    SELECT md.team_member_id, tm.name AS team_member_name, md.date,
           COALESCE(md.outbound_calls,0)     AS outbound_calls,
           COALESCE(md.talk_minutes,0)       AS talk_minutes,
           COALESCE(md.quoted_count,0)       AS quoted_count,
           COALESCE(md.sold_items,0)         AS sold_items,
           md.kpi_version_id, md.label_at_submit
    FROM metrics_daily md
    JOIN ag          ON md.agency_id = ag.id
    JOIN team_members tm ON tm.id = md.team_member_id
    WHERE md.role::text = p_role
      AND md.date BETWEEN p_start AND p_end
  )
  SELECT * FROM md
  ORDER BY team_member_name;
$$ LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public;