-- BLOCKER 1: Implement list_agency_kpis RPC function
CREATE OR REPLACE FUNCTION list_agency_kpis(_agency uuid)
RETURNS TABLE (kpi_id uuid, slug text, label text, active boolean) AS $$
  SELECT k.id, k.key, v.label, k.is_active
  FROM kpis k
  JOIN kpi_versions v ON v.kpi_id = k.id
  WHERE k.agency_id = _agency AND v.valid_to IS NULL AND k.is_active = true
  ORDER BY v.label;
$$ LANGUAGE sql STABLE SECURITY INVOKER;

-- Notify PostgREST to reload schema
SELECT pg_notify('pgrst','reload schema');