-- Weekly Playbook Data Migration
-- Backfills zone/completed from existing column_status values

-- Existing items in backlog/week1/week2/next_call → zone='bench', completed=false
UPDATE public.focus_items
SET zone = 'bench', completed = false
WHERE column_status IN ('backlog', 'week1', 'week2', 'next_call')
  AND zone = 'bench'  -- only update defaults (idempotent)
  AND completed = false;

-- Completed items → zone='bench', completed=true
UPDATE public.focus_items
SET zone = 'bench', completed = true
WHERE column_status = 'completed'
  AND completed = false;  -- only update if not already migrated (idempotent)
