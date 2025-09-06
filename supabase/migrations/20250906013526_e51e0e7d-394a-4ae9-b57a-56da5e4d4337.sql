-- Force recalculate Jane's submission with proper logging
DO $$
DECLARE
  test_result boolean;
BEGIN
  -- First test the fixed function directly
  SELECT compute_is_late(
    '8b52d7f3-04ba-49fd-b4b3-12a20bd0b2bc'::uuid, -- HFI Inc agency_id
    '{"dueBy": {"mode": "same_day", "time": "23:59"}}'::jsonb,
    '2025-09-05'::date, -- submission_date
    '2025-09-05'::date, -- work_date  
    '2025-09-06 01:28:29.465488+00:00'::timestamptz -- submitted_at (Jane's actual submission time)
  ) INTO test_result;
  
  RAISE NOTICE 'compute_is_late test result: %', test_result;
  
  -- Now force recalculate by deleting and re-running the submission processing
  DELETE FROM metrics_daily 
  WHERE team_member_id = '518a5ac1-53c4-4dc9-ba8d-21a6c8d98316' 
  AND date = '2025-09-05';
  
  -- Recalculate the submission
  PERFORM upsert_metrics_from_submission('a90bc96f-d031-4671-b6be-5f5fb90a4e57'::uuid);
  
  RAISE NOTICE 'Jane submission recalculated';
END $$;

-- Verify Jane's updated metrics after forced recalculation
SELECT 
  team_member_id,
  date,
  outbound_calls,
  talk_minutes, 
  quoted_count,
  sold_items,
  pass,
  hits,
  daily_score,
  is_late,
  is_counted_day
FROM metrics_daily 
WHERE team_member_id = '518a5ac1-53c4-4dc9-ba8d-21a6c8d98316' -- Jane Doe
AND date = '2025-09-05';