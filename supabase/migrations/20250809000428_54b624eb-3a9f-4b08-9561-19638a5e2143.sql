-- Add subheadline to prompts for optional secondary title
ALTER TABLE public.prompts
ADD COLUMN IF NOT EXISTS subheadline text;