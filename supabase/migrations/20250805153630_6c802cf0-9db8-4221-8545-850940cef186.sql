-- Add sharing controls to ai_analysis table
ALTER TABLE public.ai_analysis 
ADD COLUMN shared_with_client boolean NOT NULL DEFAULT false;

-- Add selected_uploads to track which specific files were analyzed
ALTER TABLE public.ai_analysis 
ADD COLUMN selected_uploads jsonb;