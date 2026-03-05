-- Add created_by_staff_id (or equivalent) to all 9 tables missing staff user tracking
-- Per CLAUDE.md Rule 5: tables tracking users MUST support staff

------------------------------------------------------------
-- 1. excusals (created_by is NOT NULL — must make nullable)
------------------------------------------------------------
ALTER TABLE excusals ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE excusals ADD COLUMN created_by_staff_id uuid REFERENCES staff_users(id);

------------------------------------------------------------
-- 2. user_roles
------------------------------------------------------------
ALTER TABLE user_roles ADD COLUMN created_by_staff_id uuid REFERENCES staff_users(id);

------------------------------------------------------------
-- 3. user_roles_audit (uses changed_by)
------------------------------------------------------------
ALTER TABLE user_roles_audit ADD COLUMN changed_by_staff_id uuid REFERENCES staff_users(id);

------------------------------------------------------------
-- 4. kpi_audit (uses actor_id)
------------------------------------------------------------
ALTER TABLE kpi_audit ADD COLUMN actor_staff_id uuid REFERENCES staff_users(id);

------------------------------------------------------------
-- 5. onboarding_sequences
------------------------------------------------------------
ALTER TABLE onboarding_sequences ADD COLUMN created_by_staff_id uuid REFERENCES staff_users(id);

------------------------------------------------------------
-- 6. meeting_frames (created_by is NOT NULL — must make nullable)
------------------------------------------------------------
ALTER TABLE meeting_frames ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE meeting_frames ADD COLUMN created_by_staff_id uuid REFERENCES staff_users(id);

------------------------------------------------------------
-- 7. metrics_daily_snapshots
------------------------------------------------------------
ALTER TABLE metrics_daily_snapshots ADD COLUMN created_by_staff_id uuid REFERENCES staff_users(id);

------------------------------------------------------------
-- 8. comp_comparison_reports
------------------------------------------------------------
ALTER TABLE comp_comparison_reports ADD COLUMN created_by_staff_id uuid REFERENCES staff_users(id);

------------------------------------------------------------
-- 9. sales (CRITICAL — active staff write path via create_staff_sale)
------------------------------------------------------------
ALTER TABLE sales ADD COLUMN created_by_staff_id uuid REFERENCES staff_users(id);

-- Create index for sales lookups (most queried table with staff writes)
CREATE INDEX idx_sales_created_by_staff_id
  ON sales(created_by_staff_id)
  WHERE created_by_staff_id IS NOT NULL;

-- Backfill sales created by staff: match via team_member_id → staff_users.team_member_id
-- where created_by IS NULL (staff-created sales have no created_by)
UPDATE sales s
SET created_by_staff_id = su.id
FROM staff_users su
WHERE s.created_by IS NULL
  AND s.created_by_staff_id IS NULL
  AND s.team_member_id IS NOT NULL
  AND su.team_member_id = s.team_member_id
  AND su.agency_id = s.agency_id;
