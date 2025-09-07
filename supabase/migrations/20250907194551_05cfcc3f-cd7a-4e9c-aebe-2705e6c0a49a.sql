-- Add options column to prospect_custom_fields table for dropdown support
ALTER TABLE public.prospect_custom_fields ADD COLUMN IF NOT EXISTS options TEXT[];