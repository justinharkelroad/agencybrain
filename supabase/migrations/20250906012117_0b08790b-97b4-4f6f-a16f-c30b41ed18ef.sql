-- Fix the _nz_num function to handle quoted numeric values
CREATE OR REPLACE FUNCTION public._nz_num(v jsonb)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT CASE 
    WHEN v IS NULL THEN 0
    WHEN jsonb_typeof(v) = 'string' THEN 
      CASE 
        WHEN trim(both '"' from v::text) ~ '^-?\d+\.?\d*$' 
        THEN coalesce(trim(both '"' from v::text)::numeric, 0)
        ELSE 0
      END
    ELSE coalesce(v::text::numeric, 0)
  END
$function$;

-- Clean duplicate targets (keep the most appropriate one for each agency/metric)
DELETE FROM targets t1 
WHERE t1.id NOT IN (
  SELECT DISTINCT ON (agency_id, metric_key, COALESCE(team_member_id, '00000000-0000-0000-0000-000000000000'::uuid)) id
  FROM targets
  ORDER BY agency_id, metric_key, COALESCE(team_member_id, '00000000-0000-0000-0000-000000000000'::uuid), created_at DESC
);

-- Now recalculate all existing scores
DO $$
DECLARE
  sub_id uuid;
BEGIN
  FOR sub_id IN 
    SELECT id FROM submissions WHERE final = true LIMIT 5 -- Just test a few first
  LOOP
    PERFORM upsert_metrics_from_submission(sub_id);
  END LOOP;
END $$;