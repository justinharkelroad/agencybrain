-- Set slug for Tozzi Agency (it was null)
UPDATE agencies 
SET slug = 'tozzi-agency' 
WHERE id = '186e5d3f-ed43-45a4-ac6e-2f8ea07c5084' AND slug IS NULL;