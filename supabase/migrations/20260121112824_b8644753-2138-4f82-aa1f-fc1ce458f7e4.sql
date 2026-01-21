INSERT INTO agency_call_scoring_settings (agency_id, enabled, calls_limit, reset_day)
VALUES ('979e8713-c266-4b23-96a9-fabd34f1fc9e', true, 50, 1)
ON CONFLICT (agency_id) DO UPDATE SET enabled = true, calls_limit = 50;