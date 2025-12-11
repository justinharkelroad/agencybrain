-- Drop the duplicate function with extra parameter
DROP FUNCTION IF EXISTS public.upsert_metrics_from_submission(uuid, uuid, text, timestamp with time zone);