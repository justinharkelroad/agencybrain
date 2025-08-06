-- Allow null period_id in ai_analysis table for file-only analyses
ALTER TABLE public.ai_analysis 
ALTER COLUMN period_id DROP NOT NULL;