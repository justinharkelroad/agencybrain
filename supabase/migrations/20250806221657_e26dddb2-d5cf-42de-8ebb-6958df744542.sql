-- Delete all existing periods for justin@hfiagencies.com that have pre-populated test data
DELETE FROM public.periods 
WHERE user_id = '9061db1c-2bf4-4f3d-870c-a522b5f1e1db' 
AND (
  form_data IS NOT NULL 
  AND jsonb_typeof(form_data) = 'object'
  AND (
    (form_data->'sales'->>'premium')::numeric = 0
    OR (form_data->'sales'->>'policies')::numeric = 0
    OR (form_data->'cashFlow'->>'compensation')::numeric = 0
  )
);