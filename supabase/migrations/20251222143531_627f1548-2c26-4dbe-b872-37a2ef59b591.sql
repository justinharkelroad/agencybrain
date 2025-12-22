-- Fix McBrayer Insurance slug
UPDATE public.agencies 
SET slug = 'mcbrayer-insurance', updated_at = now()
WHERE name ILIKE '%mcbrayer%' AND (slug IS NULL OR slug = '');