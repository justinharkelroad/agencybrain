-- Add coaching analysis column to both weekly review tables
ALTER TABLE public.weekly_reviews ADD COLUMN IF NOT EXISTS coaching_analysis text;
ALTER TABLE public.staff_weekly_reviews ADD COLUMN IF NOT EXISTS coaching_analysis text;
