-- Add agency_id column to form_links table
ALTER TABLE public.form_links 
ADD COLUMN agency_id uuid;

-- Add foreign key constraints
ALTER TABLE public.form_links
  ADD CONSTRAINT form_links_agency_id_fkey
  FOREIGN KEY (agency_id) REFERENCES public.agencies(id);

ALTER TABLE public.form_links
  ADD CONSTRAINT form_links_form_template_id_fkey
  FOREIGN KEY (form_template_id) REFERENCES public.form_templates(id);

-- Seed test data - ensure parents exist and upsert link row
INSERT INTO public.form_links (token, enabled, agency_id, form_template_id, expires_at)
VALUES ('30a2a3a3-53d4-4177-a63a-037c7e8680bb', true, 
        (SELECT id FROM public.agencies WHERE slug='hfi-inc'),
        (SELECT id FROM public.form_templates WHERE slug='daily-sales-scorecard'),
        NULL)
ON CONFLICT (token) DO UPDATE SET enabled=EXCLUDED.enabled,
                                   agency_id=EXCLUDED.agency_id,
                                   form_template_id=EXCLUDED.form_template_id,
                                   expires_at=EXCLUDED.expires_at;