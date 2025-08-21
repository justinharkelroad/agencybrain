-- Fix critical security vulnerability: Restrict global template access to authenticated users only
DROP POLICY "Templates: view global" ON checklist_template_items;

-- Create secure policy that requires authentication for viewing global templates
CREATE POLICY "Authenticated users can view global templates" 
ON checklist_template_items 
FOR SELECT 
TO authenticated
USING (
  agency_id IS NULL 
  AND auth.uid() IS NOT NULL
);