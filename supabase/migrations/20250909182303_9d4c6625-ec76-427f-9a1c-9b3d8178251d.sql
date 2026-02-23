-- GATE 2 Step 1: Rename KPI to create V2 (will trigger the versioning)
UPDATE kpis SET label = 'Quoted Prospects' WHERE id = '9e48cc7f-8bcc-46aa-890f-509237371e06';

-- Step 2: Create form binding to V1 (the old version before rename)
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
   WHERE k.label = 'Quoted Prospects'
     AND kv.valid_to IS NULL
   ORDER BY kv.valid_from DESC
   LIMIT 1;

  IF v_form_template_id IS NULL OR v_kpi_version_id IS NULL THEN
    RAISE NOTICE 'Skipping Gate 2 KPI binding: required form template or KPI version not found.';
    RETURN;
  END IF;

  INSERT INTO forms_kpi_bindings (form_template_id, kpi_version_id)
  VALUES (v_form_template_id, v_kpi_version_id);
END $$;
