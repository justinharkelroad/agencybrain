-- GATE 3 Setup: Create outdated scenario by renaming KPI (creates V3)
-- This will create V3 while form remains bound to V2

-- Update the KPI label to create a new version
UPDATE kpis 
SET label = 'Prospect Quotes V3'
WHERE id = '9e48cc7f-8bcc-46aa-890f-509237371e06' 
AND agency_id = (SELECT agency_id FROM agencies WHERE slug = 'hfi-inc');