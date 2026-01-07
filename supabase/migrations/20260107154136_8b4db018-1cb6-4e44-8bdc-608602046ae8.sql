-- Add products_interested array column to lqs_households
ALTER TABLE public.lqs_households 
ADD COLUMN IF NOT EXISTS products_interested text[] DEFAULT '{}';