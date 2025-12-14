-- Fix the usage count for AgencyBrain Tester (48cf6af1-fe22-4cfc-85d7-caceea87e68a)
-- They have 4 calls but usage shows 5 due to a failed insert that incremented usage
UPDATE call_usage_tracking 
SET calls_used = 4 
WHERE agency_id = '48cf6af1-fe22-4cfc-85d7-caceea87e68a' 
  AND billing_period_start = '2025-12-12';