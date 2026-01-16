-- Add agent_number column to team_members for mapping termination data producers
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS agent_number TEXT;

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_team_members_agent_number ON team_members(agent_number);