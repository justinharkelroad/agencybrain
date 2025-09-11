-- Rebind form to active KPI version to fix expired binding
UPDATE forms_kpi_bindings fb
SET kpi_version_id = (
  SELECT id FROM kpi_versions kv
  WHERE kv.kpi_id = (SELECT kpi_id FROM kpi_versions WHERE id=fb.kpi_version_id)
    AND kv.valid_to IS NULL
  ORDER BY valid_from DESC LIMIT 1
)
WHERE fb.form_template_id = (
  SELECT id FROM form_templates
  WHERE slug='custom-sales-scorecard'
    AND agency_id=(SELECT id FROM agencies WHERE slug='hfi-inc') 
  LIMIT 1
);