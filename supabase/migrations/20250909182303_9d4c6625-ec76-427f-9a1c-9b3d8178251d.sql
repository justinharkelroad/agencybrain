-- GATE 2 Step 1: Rename KPI to create V2 (will trigger the versioning)
UPDATE kpis SET label = 'Quoted Prospects' WHERE id = '9e48cc7f-8bcc-46aa-890f-509237371e06';

-- Step 2: Create form binding to V1 (the old version before rename)
INSERT INTO forms_kpi_bindings (form_template_id, kpi_version_id)
VALUES ('56166423-75c2-48b5-909a-1f68d0571dc9', '9918b3cb-551f-489a-94c2-b0f0bd56d1ee');