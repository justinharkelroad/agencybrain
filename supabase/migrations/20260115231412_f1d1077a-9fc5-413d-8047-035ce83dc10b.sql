-- Fix list_agency_kpis_by_role to filter by kpis.role column
-- This prevents duplicate KPIs from being returned when Sales and Service
-- versions of the same KPI key exist (e.g., outbound_calls, talk_minutes)

CREATE OR REPLACE FUNCTION public.list_agency_kpis_by_role(_agency uuid, _role text DEFAULT NULL)
RETURNS TABLE(kpi_id uuid, slug text, label text, active boolean)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT DISTINCT k.id AS kpi_id, k.key AS slug, v.label, k.is_active AS active
  FROM kpis k
  JOIN kpi_versions v ON v.kpi_id = k.id
  WHERE k.agency_id = _agency 
    AND v.valid_to IS NULL 
    AND k.is_active = true
    -- NEW: Filter by role on kpis table (allow NULL role KPIs for backwards compat)
    AND (_role IS NULL OR k.role IS NULL OR k.role::text = _role)
    -- Existing: Filter by selected_metrics in scorecard_rules
    AND (_role IS NULL OR k.key = ANY(
      SELECT unnest(selected_metrics) 
      FROM scorecard_rules 
      WHERE agency_id = _agency AND role::text = _role
    ))
  ORDER BY v.label;
$$;