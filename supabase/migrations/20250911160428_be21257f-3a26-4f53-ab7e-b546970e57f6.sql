-- Create function to check if form has outdated KPI bindings
CREATE OR REPLACE FUNCTION public.check_form_kpi_versions(p_form_id UUID)
RETURNS TABLE(
  kpi_id UUID,
  current_label TEXT,
  bound_label TEXT,
  bound_version_id UUID
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    k.id as kpi_id,
    current_v.label as current_label,
    bound_v.label as bound_label,
    bound_v.id as bound_version_id
  FROM forms_kpi_bindings fkb
  JOIN kpi_versions bound_v ON bound_v.id = fkb.kpi_version_id
  JOIN kpis k ON k.id = bound_v.kpi_id
  JOIN kpi_versions current_v ON current_v.kpi_id = k.id AND current_v.valid_to IS NULL
  WHERE fkb.form_template_id = p_form_id
    AND bound_v.valid_to IS NOT NULL  -- bound version is outdated
    AND bound_v.label != current_v.label; -- labels differ
$$;