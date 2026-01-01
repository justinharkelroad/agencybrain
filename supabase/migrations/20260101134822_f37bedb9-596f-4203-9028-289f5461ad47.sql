-- Add sub_producer_code to team_members table
ALTER TABLE team_members 
ADD COLUMN sub_producer_code TEXT;

-- Add index for faster lookups
CREATE INDEX idx_team_members_sub_producer_code 
ON team_members(agency_id, sub_producer_code) 
WHERE sub_producer_code IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN team_members.sub_producer_code IS 'Allstate sub-producer code (e.g., 401, 402) for commission tracking';