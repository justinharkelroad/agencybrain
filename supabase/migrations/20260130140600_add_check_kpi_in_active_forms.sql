-- Create function to check if a KPI is used in any active form templates
-- This replaces inline PostgREST query that had parsing issues with JSON text matching

CREATE OR REPLACE FUNCTION public.check_kpi_in_active_forms(
  p_agency_id uuid,
  p_kpi_key text
)
RETURNS TABLE(id uuid, name text)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT ft.id, ft.name
  FROM public.form_templates ft
  WHERE ft.agency_id = p_agency_id
    AND ft.is_active = true
    AND (
      ft.schema_json::text ILIKE '%"selectedKpiSlug":"' || p_kpi_key || '"%'
      OR ft.schema_json::text ILIKE '%"' || p_kpi_key || '"%'
    );
$$;
