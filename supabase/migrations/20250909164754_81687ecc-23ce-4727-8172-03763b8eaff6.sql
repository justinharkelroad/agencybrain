-- Create KPI binding for Gate 1 test
DO $$
DECLARE
  v_form_template_id UUID;
  v_kpi_version_id UUID;
BEGIN
  SELECT id
    INTO v_form_template_id
    FROM form_templates
   WHERE slug = 'daily-sales-scorecard'
   LIMIT 1;

  SELECT kv.id
    INTO v_kpi_version_id
    FROM kpi_versions kv
    JOIN kpis k ON k.id = kv.kpi_id
   WHERE k.key = 'sold_items'
     AND kv.valid_to IS NULL
   ORDER BY kv.valid_from DESC
   LIMIT 1;

  IF v_form_template_id IS NULL THEN
    RAISE NOTICE 'Skipping Gate 1 KPI binding: template slug daily-sales-scorecard not found.';
    RETURN;
  END IF;

  IF v_kpi_version_id IS NULL THEN
    RAISE NOTICE 'Skipping Gate 1 KPI binding: active sold_items KPI version not found.';
    RETURN;
  END IF;

  INSERT INTO forms_kpi_bindings (form_template_id, kpi_version_id)
  VALUES (v_form_template_id, v_kpi_version_id)
  ON CONFLICT (form_template_id, kpi_version_id) DO NOTHING;
END $$;
