-- Remove blocking deny-all policies from form_links
DROP POLICY IF EXISTS "deny_all_links" ON form_links;
DROP POLICY IF EXISTS "p_links_select" ON form_links;

-- Remove blocking deny-all policies from form_templates  
DROP POLICY IF EXISTS "deny_all_templates" ON form_templates;
DROP POLICY IF EXISTS "p_templates_select" ON form_templates;

-- Add proper public SELECT policy for form_links (for public form access)
CREATE POLICY "public_can_select_enabled_links" ON form_links
FOR SELECT
TO public
USING (enabled = true);

-- Add proper public SELECT policy for form_templates (for public form access)
CREATE POLICY "public_can_select_active_templates" ON form_templates
FOR SELECT  
TO public
USING (is_active = true);