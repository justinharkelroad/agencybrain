-- Add documents_json column to challenge_lessons for downloadable document links
ALTER TABLE public.challenge_lessons
ADD COLUMN documents_json JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.challenge_lessons.documents_json IS 'Array of document objects {id, name, url} for downloadable resources';