-- Rename FK constraints to match PostgREST expectations
ALTER TABLE public.form_links
  RENAME CONSTRAINT form_links_form_template_id_fkey
  TO fk_form_links_form_templates;

ALTER TABLE public.form_links  
  RENAME CONSTRAINT form_links_agency_id_fkey
  TO fk_form_links_agencies;