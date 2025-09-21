-- Phase 0: Semantic Field Mapping for Explorer - Database Migration
-- Add semantic mapping to form templates with RLS policies

-- Add field_mappings column to form_templates
ALTER TABLE public.form_templates
ADD COLUMN IF NOT EXISTS field_mappings jsonb DEFAULT '{}'::jsonb;

-- Add comment for clarity
COMMENT ON COLUMN public.form_templates.field_mappings IS
'JSON mapping of schema field keys to canonical metrics, e.g. {
  "repeater": { "quotedDetails": {
    "items_quoted": "field_1757604704271",
    "policies_quoted": "field_1757604704272", 
    "premium_potential_cents": "field_1757604704273"
  }},
  "root": { "work_date": "field_..." }
}';

-- Add RLS policies for field_mappings
-- Users can SELECT their agency's form templates (already covered by existing policy)
-- Users can UPDATE their agency's form templates (already covered by existing policy)
-- The existing policies on form_templates already handle agency access control via has_agency_access()

-- Add audit logging table for field mapping operations
CREATE TABLE IF NOT EXISTS public.field_mapping_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL,
  form_template_id uuid NOT NULL,
  agency_id uuid NOT NULL,
  mappings_used boolean NOT NULL DEFAULT false,
  items_extracted integer DEFAULT NULL,
  policies_extracted integer DEFAULT NULL,
  premium_extracted bigint DEFAULT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on audit table
ALTER TABLE public.field_mapping_audit ENABLE ROW LEVEL SECURITY;

-- RLS policy for audit table - agency users can view their own audit logs
CREATE POLICY "Users can view their agency field mapping audit logs"
ON public.field_mapping_audit
FOR SELECT
USING (has_agency_access(auth.uid(), agency_id));

-- Only system can insert audit logs (via flattener function)
CREATE POLICY "System can insert field mapping audit logs"
ON public.field_mapping_audit
FOR INSERT
WITH CHECK (true);

-- Add index for efficient querying
CREATE INDEX IF NOT EXISTS idx_field_mapping_audit_submission 
ON public.field_mapping_audit(submission_id);
CREATE INDEX IF NOT EXISTS idx_field_mapping_audit_agency_date 
ON public.field_mapping_audit(agency_id, created_at);

-- Ensure quoted_household_details columns are properly typed (already exist)
-- items_quoted: integer, policies_quoted: integer, premium_potential_cents: bigint