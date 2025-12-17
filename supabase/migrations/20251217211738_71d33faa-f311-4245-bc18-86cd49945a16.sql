-- First, clean up any duplicate form_template_id entries (keep the most recent)
DELETE FROM public.form_links
WHERE id NOT IN (
  SELECT DISTINCT ON (form_template_id) id
  FROM public.form_links
  ORDER BY form_template_id, created_at DESC
);

-- Now add the unique constraint so upsert with onConflict works
ALTER TABLE public.form_links
ADD CONSTRAINT form_links_form_template_id_unique UNIQUE (form_template_id);