-- Add foreign key column to staff_users for team member linking
ALTER TABLE staff_users 
ADD COLUMN team_member_id uuid REFERENCES team_members(id);

-- Index for fast lookups
CREATE INDEX idx_staff_users_team_member ON staff_users(team_member_id);

-- Unique constraint - one staff user per team member
ALTER TABLE staff_users 
ADD CONSTRAINT unique_staff_team_member UNIQUE (team_member_id);