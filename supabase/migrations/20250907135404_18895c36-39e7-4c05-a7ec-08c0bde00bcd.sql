-- Update Jane's submission record to correct the late flag
UPDATE submissions 
SET late = false 
WHERE id = 'e20f2295-b026-45cd-8e40-aee6e72dcacd';

-- Force recalculate Jane's metrics with the corrected submission
DELETE FROM metrics_daily 
WHERE team_member_id = '518a5ac1-53c4-4dc9-ba8d-21a6c8d98316' 
AND date = '2025-09-05';

SELECT upsert_metrics_from_submission('e20f2295-b026-45cd-8e40-aee6e72dcacd'::uuid);

-- Verify Jane's corrected metrics
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