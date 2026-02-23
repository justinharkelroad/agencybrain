-- Add missing columns with proper constraints
ALTER TABLE form_links ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

ALTER TABLE form_templates ADD COLUMN IF NOT EXISTS status TEXT 
  CHECK (status IN ('draft','published')) DEFAULT 'draft';

-- Create unique constraints to prevent collisions
CREATE UNIQUE INDEX IF NOT EXISTS uidx_templates_agency_slug
  ON form_templates(agency_id, slug);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_links_token 
  ON form_links(token);

-- Enable RLS on all form-related tables
ALTER TABLE public.form_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_templates ENABLE ROW LEVEL SECURITY; 

DO $$
BEGIN
  IF to_regclass('public.form_fields') IS NOT NULL THEN
    ALTER TABLE public.form_fields ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Lock down anonymous access completely
DROP POLICY IF EXISTS deny_all_links ON public.form_links;
CREATE POLICY deny_all_links ON public.form_links 
  FOR SELECT USING (false);

DROP POLICY IF EXISTS deny_all_templates ON public.form_templates;
CREATE POLICY deny_all_templates ON public.form_templates 
  FOR SELECT USING (false);

DO $$
BEGIN
  IF to_regclass('public.form_fields') IS NOT NULL THEN
    DROP POLICY IF EXISTS deny_all_fields ON public.form_fields;
    CREATE POLICY deny_all_fields ON public.form_fields 
      FOR SELECT USING (false);
  END IF;
END $$;
