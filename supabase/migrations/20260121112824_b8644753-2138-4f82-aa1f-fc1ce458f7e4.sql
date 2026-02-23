INSERT INTO agency_call_scoring_settings (agency_id, enabled, calls_limit, reset_day)
SELECT '979e8713-c266-4b23-96a9-fabd34f1fc9e'::uuid, true, 50, 1
WHERE EXISTS (
  SELECT 1 FROM public.agencies
  WHERE id = '979e8713-c266-4b23-96a9-fabd34f1fc9e'::uuid
)
ON CONFLICT (agency_id) DO UPDATE SET enabled = true, calls_limit = 50;
