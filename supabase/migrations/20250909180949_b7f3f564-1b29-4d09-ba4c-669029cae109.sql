-- GATE 1: Remove legacy 1-arg overload that causes ambiguity
DROP FUNCTION IF EXISTS public.upsert_metrics_from_submission(uuid);

-- Reload PostgREST to clear function cache
SELECT pg_notify('pgrst','reload schema');