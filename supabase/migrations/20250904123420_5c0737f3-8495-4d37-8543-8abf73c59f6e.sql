-- Drop the duplicate foreign key constraint that's causing PostgREST confusion
ALTER TABLE form_links DROP CONSTRAINT IF EXISTS fk_form_links_form_templates;

-- Keep only the proper constraint: fk_form_links_form_template_id
-- (This one should already exist and is the correct one)