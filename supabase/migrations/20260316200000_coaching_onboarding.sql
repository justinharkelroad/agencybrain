-- Migration: Coaching onboarding support
-- Adds questionnaire storage for 8-Week Experience onboarding
-- Creates public storage bucket for onboarding assets (Sales Process PDF)

-- 1. Add onboarding_questionnaire JSONB column to sales_experience_assignments
ALTER TABLE public.sales_experience_assignments
  ADD COLUMN IF NOT EXISTS onboarding_questionnaire jsonb;

COMMENT ON COLUMN public.sales_experience_assignments.onboarding_questionnaire IS
  'Stores questionnaire answers collected during self-service onboarding (lead mgmt system, accountability method, struggles, hoped outcome)';

-- 2. Public storage bucket for onboarding assets (downloadable PDFs)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'onboarding-assets',
  'onboarding-assets',
  true,
  10485760,  -- 10 MB
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to read files from this bucket (it's public)
CREATE POLICY "Public read onboarding assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'onboarding-assets');
