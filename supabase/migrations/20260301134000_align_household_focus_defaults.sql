-- Align legacy Household Focus team defaults to new baseline values.
-- This only updates rows that exactly match the previous baseline.
UPDATE public.household_focus_targets
SET
  close_rate = 20.00,
  avg_items_per_household = 2.30,
  avg_policies_per_household = 1.80,
  avg_value_per_item = 900,
  target_items = 120,
  target_commission = 8640,
  mode = 'items',
  updated_at = now()
WHERE team_member_id IS NULL
  AND mode = 'items'
  AND target_items = 120
  AND close_rate = 29.00
  AND avg_items_per_household = 2.00
  AND avg_policies_per_household = 1.40
  AND avg_value_per_item = 900;
