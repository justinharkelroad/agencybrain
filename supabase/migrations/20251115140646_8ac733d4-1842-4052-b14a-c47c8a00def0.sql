-- Add session_id column to life_targets_brainstorm table
ALTER TABLE life_targets_brainstorm 
ADD COLUMN session_id UUID DEFAULT gen_random_uuid();

-- Create index for efficient querying by user, quarter, and session
CREATE INDEX idx_brainstorm_session 
ON life_targets_brainstorm(user_id, quarter, session_id);

-- Create index for querying selected targets
CREATE INDEX idx_brainstorm_selected 
ON life_targets_brainstorm(user_id, quarter, is_selected) 
WHERE is_selected = true;

-- Add comment for documentation
COMMENT ON COLUMN life_targets_brainstorm.session_id IS 'Groups brainstorm targets into sessions - allows users to have multiple brainstorm attempts per quarter';