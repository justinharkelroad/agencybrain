-- Backfill metrics_daily version fields for last 30 days using proper joins
UPDATE metrics_daily md
SET kpi_version_id = b.kpi_version_id,
    label_at_submit = kv.label
FROM submissions s
JOIN forms_kpi_bindings b ON b.form_template_id = s.form_template_id
JOIN kpi_versions kv ON kv.id = b.kpi_version_id
WHERE md.final_submission_id = s.id
  AND md.date >= CURRENT_DATE - INTERVAL '30 days'
  AND md.kpi_version_id IS NULL;