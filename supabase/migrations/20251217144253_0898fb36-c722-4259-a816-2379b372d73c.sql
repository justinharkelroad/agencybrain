-- Fix the existing call_usage_tracking record to use the correct limit of 100
UPDATE call_usage_tracking 
SET calls_limit = 100 
WHERE agency_id = '907b314c-e3b8-4cc1-956d-aa82ca2c016b'
  AND period_end >= NOW();