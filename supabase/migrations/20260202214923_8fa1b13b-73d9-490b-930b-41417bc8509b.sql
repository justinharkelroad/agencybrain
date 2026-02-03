-- Add documents_json column to sales_experience_lessons table
ALTER TABLE public.sales_experience_lessons
ADD COLUMN documents_json jsonb DEFAULT '[]'::jsonb;