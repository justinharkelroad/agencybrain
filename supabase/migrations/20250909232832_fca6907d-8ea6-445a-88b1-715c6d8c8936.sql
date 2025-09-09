-- Create RPC function to bind form KPIs
CREATE OR REPLACE FUNCTION bind_form_kpis(p_form uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  f jsonb; r record; v uuid;
BEGIN
  SELECT schema_json INTO f FROM form_templates WHERE id=p_form;
  DELETE FROM forms_kpi_bindings WHERE form_template_id=p_form;
  FOR r IN
    SELECT (elem->>'selectedKpiId')::uuid AS kpi_id
    FROM jsonb_array_elements(f->'kpis') elem
    WHERE elem->>'selectedKpiId' IS NOT NULL
  LOOP
    SELECT id INTO v FROM kpi_versions
    WHERE kpi_id=r.kpi_id AND valid_to IS NULL
    ORDER BY valid_from DESC LIMIT 1;
    IF v IS NOT NULL THEN
      INSERT INTO forms_kpi_bindings(form_template_id,kpi_version_id)
      VALUES (p_form,v);
    END IF;
  END LOOP;
END $$;