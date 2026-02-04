-- Update RPC function to exclude team members with include_in_metrics = false
CREATE OR REPLACE FUNCTION public.get_versioned_dashboard_data(
  p_agency_slug text,
  p_role text,
  p_start date,
  p_end date
)
RETURNS TABLE(
  date date,
  team_member_id uuid,
  team_member_name text,
  kpi_key text,
  kpi_label text,
  kpi_version_id uuid,
  value numeric,
  pass boolean,
  hits int,
  daily_score int,
  is_late boolean
) AS $$
WITH agency AS (
  SELECT id FROM agencies WHERE slug = p_agency_slug
),
base AS (
  SELECT
    md.date,
    md.team_member_id,
    tm.name AS team_member_name,
    k.key AS kpi_key,
    COALESCE(md.label_at_submit, kv.label) AS kpi_label,
    md.kpi_version_id,
    (COALESCE(md.outbound_calls,0)
     + COALESCE(md.talk_minutes,0)
     + COALESCE(md.quoted_count,0)
     + COALESCE(md.sold_items,0))::numeric AS value,
    COALESCE(md.pass,false) AS pass,
    COALESCE(md.hits,0) AS hits,
    COALESCE(md.daily_score,0) AS daily_score,
    COALESCE(md.is_late,false) AS is_late
  FROM metrics_daily md
  JOIN agency a ON md.agency_id = a.id
  JOIN team_members tm ON tm.id = md.team_member_id
    AND tm.include_in_metrics = true
  LEFT JOIN kpi_versions kv ON kv.id = md.kpi_version_id
  LEFT JOIN kpis k ON k.id = kv.kpi_id
  -- require a matching final submission for that tm/date
  JOIN submissions s
    ON s.team_member_id = md.team_member_id
   AND COALESCE(s.work_date, s.submission_date) = md.date
   AND s.final IS TRUE
  WHERE md.role::text = p_role
    AND md.date BETWEEN p_start AND p_end
)
SELECT * FROM base
ORDER BY date DESC, team_member_name ASC;
$$ LANGUAGE sql STABLE SECURITY INVOKER;

SELECT pg_notify('pgrst','reload schema');
