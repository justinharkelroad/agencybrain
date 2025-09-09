-- BLOCKER 2: Drop and recreate get_versioned_dashboard_data to fix nested aggregates
DROP FUNCTION IF EXISTS get_versioned_dashboard_data(text, text, boolean);

CREATE OR REPLACE FUNCTION get_versioned_dashboard_data(
  p_agency_slug text,
  p_role text,
  p_consolidate_versions boolean DEFAULT false
)
RETURNS TABLE(
  date date,
  kpi_version_id uuid,
  display_label text,
  total_val numeric
) AS $$
WITH base AS (
  SELECT md.agency_id, md.date, md.kpi_version_id,
         md.outbound_calls::numeric + md.talk_minutes::numeric + 
         md.quoted_count::numeric + md.sold_items::numeric AS val, 
         md.label_at_submit
  FROM metrics_daily md
  JOIN agencies a ON a.id = md.agency_id
  WHERE a.slug = p_agency_slug
    AND md.role::text = p_role
    AND md.date >= CURRENT_DATE - INTERVAL '30 days'
    AND md.kpi_version_id IS NOT NULL
),
agg AS (
  SELECT date, kpi_version_id, SUM(val) AS total_val
  FROM base
  GROUP BY 1,2
)
SELECT a.date,
       a.kpi_version_id,
       COALESCE(b.label_at_submit, kv.label) AS display_label,
       a.total_val
FROM agg a
LEFT JOIN base b
  ON b.date = a.date AND b.kpi_version_id = a.kpi_version_id
LEFT JOIN kpi_versions kv
  ON kv.id = a.kpi_version_id
ORDER BY a.date DESC;
$$ LANGUAGE sql STABLE SECURITY INVOKER;

-- Notify PostgREST to reload schema
SELECT pg_notify('pgrst','reload schema');