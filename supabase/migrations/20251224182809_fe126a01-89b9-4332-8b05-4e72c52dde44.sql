-- Fix the test account's call scoring settings
INSERT INTO agency_call_scoring_settings (agency_id, enabled, calls_limit, reset_day, updated_at)
SELECT 'e05234c6-18e9-4fd4-9a19-35845bb6bad6'::uuid, true, 30, 24, now()
WHERE EXISTS (
  SELECT 1
  FROM public.agencies
  WHERE id = 'e05234c6-18e9-4fd4-9a19-35845bb6bad6'::uuid
)
ON CONFLICT (agency_id) 
DO UPDATE SET enabled = true, calls_limit = 30, reset_day = 24, updated_at = now();
