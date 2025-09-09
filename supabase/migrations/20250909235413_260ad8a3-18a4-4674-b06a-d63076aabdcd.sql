-- Backfill metrics_daily version fields for last 30 days
UPDATE metrics_daily md
SET kpi_version_id = b.kpi_version_id,
    label_at_submit = kv.label
FROM forms_kpi_bindings b
JOIN kpi_versions kv ON kv.id = b.kpi_version_id
WHERE md.form_template_id = b.form_template_id
  AND md.date >= CURRENT_DATE - INTERVAL '30 days'
  AND md.kpi_version_id IS NULL;