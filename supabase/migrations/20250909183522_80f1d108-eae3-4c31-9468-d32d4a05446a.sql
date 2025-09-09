-- GATE 2 Step 2: Update form binding from V1 to V2
-- Remove the V1 binding
DELETE FROM forms_kpi_bindings 
WHERE form_template_id = '56166423-75c2-48b5-909a-1f68d0571dc9' 
AND kpi_version_id = '9918b3cb-551f-489a-94c2-b0f0bd56d1ee';

-- Add binding to V2 (the current active version after rename)
INSERT INTO forms_kpi_bindings (form_template_id, kpi_version_id)
SELECT '56166423-75c2-48b5-909a-1f68d0571dc9', kv.id
FROM kpi_versions kv
WHERE kv.kpi_id = '9e48cc7f-8bcc-46aa-890f-509237371e06' 
AND kv.valid_to IS NULL;