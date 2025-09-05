-- Clean up leadSources from existing form_templates.schema_json
-- This removes the embedded leadSources field that forms were incorrectly storing

UPDATE form_templates 
SET schema_json = schema_json - 'leadSources'
WHERE schema_json ? 'leadSources';

-- Update any form links that have null agency_id to use the agency_id from the form_template
UPDATE form_links fl
SET agency_id = ft.agency_id
FROM form_templates ft
WHERE fl.form_template_id = ft.id 
  AND fl.agency_id IS NULL;