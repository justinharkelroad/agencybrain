-- GATE 4: Create test metrics_daily record with V3 KPI label to show label_at_submit
-- This simulates a form submission today with the updated KPI binding

-- First delete any existing record for today for this team member
DELETE FROM metrics_daily 
WHERE agency_id = (SELECT id FROM agencies WHERE slug = 'hfi-inc')
  AND team_member_id = '518a5ac1-53c4-4dc9-ba8d-21a6c8d98316'
  AND date = CURRENT_DATE;

-- Insert new record with V3 label
INSERT INTO metrics_daily (
  agency_id,
  team_member_id,
  date,
  role,
  kpi_version_id,
  label_at_submit,
  outbound_calls,
  talk_minutes,
  quoted_count,
  sold_items,
  pass,
  hits,
  daily_score,
  streak_count
) VALUES (
  (SELECT id FROM agencies WHERE slug = 'hfi-inc'),
  '518a5ac1-53c4-4dc9-ba8d-21a6c8d98316', -- Jane Doe (Sales)
  CURRENT_DATE,
  'Sales',
  '48431826-6fa0-4e16-8fca-ba12d0834037', -- Prospect Quotes V3 version
  'Prospect Quotes V3', -- This is the key: label_at_submit shows the NEW label
  25,
  120,
  3,
  1,
  true,
  3,
  85,
  2
);