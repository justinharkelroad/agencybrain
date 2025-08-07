-- Clean up corrupted draft periods with no form data
DELETE FROM public.periods 
WHERE status = 'draft' 
AND (form_data IS NULL OR jsonb_typeof(form_data) = 'null' OR form_data = 'null'::jsonb);