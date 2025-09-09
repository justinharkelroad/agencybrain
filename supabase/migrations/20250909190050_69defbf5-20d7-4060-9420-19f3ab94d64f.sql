-- GATE 3 Test: Simulate "Update Form" button click
-- This replicates what useUpdateFormKpiBinding does

-- Step 1: Remove existing binding (V2)
DELETE FROM forms_kpi_bindings 
WHERE form_template_id = '56166423-75c2-48b5-909a-1f68d0571dc9';

-- Step 2: Add binding to current version (V3)
INSERT INTO forms_kpi_bindings (form_template_id, kpi_version_id)
SELECT '56166423-75c2-48b5-909a-1f68d0571dc9', kv.id
FROM kpi_versions kv
WHERE kv.kpi_id = '9e48cc7f-8bcc-46aa-890f-509237371e06' 
AND kv.valid_to IS NULL;