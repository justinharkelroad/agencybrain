-- PHASE A TEST DATA: Create form KPI binding for testing submission path
-- Bind the daily-metrics form to the "Items Sold" KPI version

INSERT INTO forms_kpi_bindings (form_template_id, kpi_version_id)
SELECT 
  ft.id,
  kv.id
FROM form_templates ft
CROSS JOIN kpi_versions kv
JOIN kpis k ON k.id = kv.kpi_id
WHERE ft.slug = 'daily-metrics' 
  AND k.key = 'sold_items'
  AND kv.valid_to IS NULL
ON CONFLICT (form_template_id, kpi_version_id) DO NOTHING;

-- Verify the binding was created
SELECT 
  ft.name as form_name,
  ft.slug as form_slug,
  k.key as kpi_key,
  kv.label as kpi_version_label,
  fkb.created_at as binding_created
FROM forms_kpi_bindings fkb
JOIN form_templates ft ON ft.id = fkb.form_template_id  
JOIN kpi_versions kv ON kv.id = fkb.kpi_version_id
JOIN kpis k ON k.id = kv.kpi_id
ORDER BY fkb.created_at DESC
LIMIT 5;