-- Remove duplicate agencies, keeping the oldest one for each name
DELETE FROM public.agencies 
WHERE id IN (
  SELECT id FROM (
    SELECT id, 
           ROW_NUMBER() OVER (PARTITION BY name ORDER BY created_at ASC) as rn
    FROM public.agencies
  ) ranked
  WHERE rn > 1
);