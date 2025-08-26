-- Add missing columns with proper constraints
ALTER TABLE form_links ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

ALTER TABLE form_templates ADD COLUMN IF NOT EXISTS status TEXT 
  CHECK (status IN ('draft','published')) DEFAULT 'draft';

-- Create unique constraints to prevent collisions
CREATE UNIQUE INDEX IF NOT EXISTS uidx_templates_agency_slug
  ON form_templates(agency_id, slug);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_links_token 
  ON form_links(token);

-- Lock down anonymous access on existing form tables
DROP POLICY IF EXISTS deny_all_links ON form_links;
DROP POLICY IF EXISTS deny_all_templates ON form_templates;

CREATE POLICY deny_all_links ON form_links 
  FOR SELECT USING (false);

CREATE POLICY deny_all_templates ON form_templates 
  FOR SELECT USING (false);