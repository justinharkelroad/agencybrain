-- One-time fix: Manually reprocess the Dec 10 submission to apply the fixed key reading
-- This calls the updated function which now reads both quoted_households and items_sold keys

SELECT upsert_metrics_from_submission('a7681987-5510-41d4-90f8-79928973c195'::uuid, NULL::uuid, NULL::text);