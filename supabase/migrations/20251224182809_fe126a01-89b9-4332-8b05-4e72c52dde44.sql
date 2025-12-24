-- Fix the test account's call scoring settings
INSERT INTO agency_call_scoring_settings (agency_id, enabled, calls_limit, reset_day, updated_at)
VALUES ('e05234c6-18e9-4fd4-9a19-35845bb6bad6', true, 30, 24, now())
ON CONFLICT (agency_id) 
DO UPDATE SET enabled = true, calls_limit = 30, reset_day = 24, updated_at = now();