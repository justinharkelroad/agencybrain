-- Create function to auto-rebind all forms when a new KPI version is created
CREATE OR REPLACE FUNCTION auto_rebind_forms_on_kpi_version()
RETURNS TRIGGER AS $$
BEGIN
  -- Find all published forms that have this KPI in their schema_json
  -- and rebind them to pick up the new version
  PERFORM bind_form_kpis(ft.id)
  FROM form_templates ft
  WHERE ft.is_active = true
    AND ft.schema_json IS NOT NULL
    AND EXISTS (
      SELECT 1 
      FROM jsonb_array_elements(ft.schema_json->'kpis') AS kpi
      WHERE kpi->>'selectedKpiId' = NEW.kpi_id::text
    );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger that fires when a new KPI version is inserted
DROP TRIGGER IF EXISTS trigger_auto_rebind_on_kpi_version ON kpi_versions;
CREATE TRIGGER trigger_auto_rebind_on_kpi_version
AFTER INSERT ON kpi_versions
FOR EACH ROW
EXECUTE FUNCTION auto_rebind_forms_on_kpi_version();

-- BACKFILL: Fix the broken Standard Playbook Inc form immediately
SELECT bind_form_kpis('f3257bf6-1222-4a08-b16b-cdc3c198b9f6'::uuid);

-- Also backfill ALL forms that might have incomplete bindings
-- This finds forms with KPIs in schema but fewer bindings than expected
DO $$
DECLARE
  form_record RECORD;
BEGIN
  FOR form_record IN
    SELECT ft.id, ft.name,
           jsonb_array_length(COALESCE(ft.schema_json->'kpis', '[]'::jsonb)) as expected_kpis,
           (SELECT COUNT(*) FROM forms_kpi_bindings fkb WHERE fkb.form_template_id = ft.id) as actual_bindings
    FROM form_templates ft
    WHERE ft.is_active = true
      AND ft.schema_json IS NOT NULL
      AND jsonb_array_length(COALESCE(ft.schema_json->'kpis', '[]'::jsonb)) > 0
  LOOP
    IF form_record.expected_kpis != form_record.actual_bindings THEN
      RAISE NOTICE 'Rebinding form: % (expected: %, actual: %)', 
        form_record.name, form_record.expected_kpis, form_record.actual_bindings;
      PERFORM bind_form_kpis(form_record.id);
    END IF;
  END LOOP;
END $$;