-- PHASE 1: Critical Data Fixes

-- First, populate agency slugs from names with proper sanitization
UPDATE public.agencies 
SET slug = LOWER(
  REGEXP_REPLACE(
    REGEXP_REPLACE(
      TRIM(name), 
      '[^a-zA-Z0-9\s-]', '', 'g'
    ), 
    '\s+', '-', 'g'
  )
)
WHERE slug IS NULL OR slug = '';

-- Ensure slug uniqueness by appending numbers where needed
WITH numbered_agencies AS (
  SELECT 
    id,
    slug,
    ROW_NUMBER() OVER (PARTITION BY slug ORDER BY created_at) as rn
  FROM public.agencies 
  WHERE slug IS NOT NULL
)
UPDATE public.agencies 
SET slug = CASE 
  WHEN na.rn > 1 THEN na.slug || '-' || na.rn::text
  ELSE na.slug
END
FROM numbered_agencies na
WHERE agencies.id = na.id AND na.rn > 1;

-- Update all forms from 'draft' to 'published' status
UPDATE public.form_templates 
SET status = 'published' 
WHERE status = 'draft' OR status IS NULL;

-- Add default status for new forms
ALTER TABLE public.form_templates 
ALTER COLUMN status SET DEFAULT 'published';

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_agencies_slug ON public.agencies(slug);
CREATE INDEX IF NOT EXISTS idx_form_templates_status ON public.form_templates(status);
CREATE INDEX IF NOT EXISTS idx_form_links_enabled_expires ON public.form_links(enabled, expires_at);

-- Add analytics tracking tables
CREATE TABLE IF NOT EXISTS public.form_link_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  form_link_id UUID NOT NULL,
  agency_id UUID NOT NULL,
  user_agent TEXT,
  ip_address INET,
  referer TEXT,
  accessed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  form_submitted BOOLEAN DEFAULT false,
  submission_id UUID
);

-- Enable RLS on analytics
ALTER TABLE public.form_link_analytics ENABLE ROW LEVEL SECURITY;

-- Analytics policies
CREATE POLICY "Users can view their agency analytics" 
ON public.form_link_analytics 
FOR SELECT 
USING (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Public can insert analytics via valid token" 
ON public.form_link_analytics 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM form_links fl 
    JOIN form_templates ft ON ft.id = fl.form_template_id
    WHERE fl.id = form_link_analytics.form_link_id 
    AND ft.agency_id = form_link_analytics.agency_id
    AND fl.enabled = true 
    AND (fl.expires_at IS NULL OR fl.expires_at > now())
  )
);