-- Switch delegate from profiles FK to team_members FK
-- so managers (who may only have staff logins) can be delegates
ALTER TABLE sales_experience_assignments DROP COLUMN IF EXISTS delegate_user_id;
DROP INDEX IF EXISTS idx_se_assignments_delegate;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sales_experience_assignments'
      AND column_name = 'delegate_team_member_id'
  ) THEN
    ALTER TABLE sales_experience_assignments
      ADD COLUMN delegate_team_member_id uuid REFERENCES team_members(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_se_assignments_delegate_tm
  ON sales_experience_assignments (delegate_team_member_id)
  WHERE delegate_team_member_id IS NOT NULL;
