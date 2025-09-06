-- Fix timezone conversion bug in compute_is_late function
CREATE OR REPLACE FUNCTION public.compute_is_late(p_agency_id uuid, p_settings jsonb, p_submission_date date, p_work_date date, p_submitted_at timestamp with time zone)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  tz text;
  mode text;
  t text;
  off_minutes int;
  base_date date;
  due_ts timestamptz;
BEGIN
  SELECT timezone INTO tz FROM agencies WHERE id = p_agency_id;
  mode := COALESCE(p_settings->'dueBy'->>'mode','same_day');
  t := COALESCE(p_settings->'dueBy'->>'time','23:59');
  off_minutes := COALESCE((p_settings->'dueBy'->>'minutes')::int, 0);
  base_date := COALESCE(p_work_date, p_submission_date);
  
  -- Fix: Properly construct the due timestamp in agency timezone
  IF mode = 'same_day' THEN
    -- Create timestamp in agency timezone, then convert to UTC for comparison
    due_ts := (base_date::text || ' ' || t)::timestamp AT TIME ZONE tz;
  ELSIF mode = 'next_day' THEN
    due_ts := ((base_date + 1)::text || ' ' || t)::timestamp AT TIME ZONE tz;
  ELSE
    -- Default to same day
    due_ts := (base_date::text || ' ' || t)::timestamp AT TIME ZONE tz;
  END IF;
  
  -- Add offset minutes if specified
  due_ts := due_ts + (off_minutes || ' minutes')::interval;
  
  -- Compare submission time (already in UTC) with due time (now in UTC)
  RETURN p_submitted_at > due_ts;
END;
$function$;

-- Test the fix with Jane's submission parameters
-- Jane submitted at 2025-09-06 01:28:29.465488+00:00 (UTC) which is 9:28 PM Eastern on Sept 5
-- Due time should be 11:59 PM Eastern on Sept 5 (2025-09-06 03:59:00+00:00 UTC)
-- This should return FALSE (not late)
SELECT compute_is_late(
  '8b52d7f3-04ba-49fd-b4b3-12a20bd0b2bc'::uuid, -- HFI Inc agency_id
  '{"dueBy": {"mode": "same_day", "time": "23:59"}}'::jsonb,
  '2025-09-05'::date, -- submission_date
  '2025-09-05'::date, -- work_date  
  '2025-09-06 01:28:29.465488+00:00'::timestamptz -- submitted_at (Jane's actual submission time)
) AS is_late_test;

-- Recalculate Jane's submission to fix her score
SELECT upsert_metrics_from_submission('a90bc96f-d031-4671-b6be-5f5fb90a4e57'::uuid);

-- Verify the fix by checking Jane's updated metrics
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