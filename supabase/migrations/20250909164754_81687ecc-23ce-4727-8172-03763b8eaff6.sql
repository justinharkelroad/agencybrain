-- Create KPI binding for Gate 1 test
INSERT INTO forms_kpi_bindings (form_template_id, kpi_version_id)
VALUES ('8efe9110-2a01-450a-be7b-a1f0bfe4cffc', 'bf8feed4-4342-4b4c-b98b-ec87c59d7c36')
ON CONFLICT (form_template_id, kpi_version_id) DO NOTHING;