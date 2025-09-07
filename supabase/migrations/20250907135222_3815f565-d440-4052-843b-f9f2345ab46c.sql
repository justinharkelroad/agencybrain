-- Test compute_is_late with correct parameters
SELECT compute_is_late(
  '3c58f6f6-99cd-4c7d-97bc-3b16310ed4ba'::uuid, -- Correct HFI INC agency_id
  '{"dueBy": {"mode": "same_day", "time": "23:59"}}'::jsonb,
  '2025-09-05'::date, -- submission_date
  '2025-09-05'::date, -- work_date  
  '2025-09-06 01:28:22.331413+00'::timestamptz -- Jane's actual submitted_at time
) AS is_late_test;

-- Delete Jane's existing metrics for Sept 5 to force recalculation
DELETE FROM metrics_daily 
WHERE team_member_id = '518a5ac1-53c4-4dc9-ba8d-21a6c8d98316' 
AND date = '2025-09-05';

-- Recalculate Jane's submission with correct ID
SELECT upsert_metrics_from_submission('e20f2295-b026-45cd-8e40-aee6e72dcacd'::uuid);

-- Verify Jane's updated metrics
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