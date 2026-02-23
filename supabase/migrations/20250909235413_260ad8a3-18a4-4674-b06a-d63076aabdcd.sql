-- Backfill metrics_daily version fields for last 30 days.
-- Support both historical and refactored metrics_daily schemas:
-- * some environments include form_template_id directly on metrics_daily
-- * some environments resolve the form via final_submission_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'metrics_daily'
      AND column_name = 'form_template_id'
  ) THEN
    UPDATE public.metrics_daily md
    SET kpi_version_id = b.kpi_version_id,
        label_at_submit = kv.label
    FROM public.forms_kpi_bindings b
    JOIN public.kpi_versions kv ON kv.id = b.kpi_version_id
    WHERE md.form_template_id = b.form_template_id
      AND md.date >= CURRENT_DATE - INTERVAL '30 days'
      AND md.kpi_version_id IS NULL;
  ELSE
    UPDATE public.metrics_daily md
    SET kpi_version_id = b.kpi_version_id,
        label_at_submit = kv.label
    FROM public.submissions s
    JOIN public.forms_kpi_bindings b ON b.form_template_id = s.form_template_id
    JOIN public.kpi_versions kv ON kv.id = b.kpi_version_id
    WHERE md.final_submission_id = s.id
      AND md.date >= CURRENT_DATE - INTERVAL '30 days'
      AND md.kpi_version_id IS NULL;
  END IF;
END $$;
