-- Add include_in_metrics column to team_members table
-- When false, member is excluded from all metrics calculations and compliance tracking
ALTER TABLE team_members
ADD COLUMN IF NOT EXISTS include_in_metrics BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN team_members.include_in_metrics IS
  'When false, member is excluded from all metrics calculations and compliance tracking';

-- Partial index for efficient filtering of members included in metrics
CREATE INDEX IF NOT EXISTS idx_team_members_include_in_metrics
ON team_members(agency_id, include_in_metrics)
WHERE include_in_metrics = true;
