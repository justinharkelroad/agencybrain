-- Add columns to track split calls (calls uploaded as two separate audio files)
-- This helps with analytics and displaying both filenames in the UI

ALTER TABLE agency_calls
ADD COLUMN IF NOT EXISTS is_split_call BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS secondary_original_filename TEXT;

-- Add comment for documentation
COMMENT ON COLUMN agency_calls.is_split_call IS 'True if this call was uploaded as two separate audio files that were merged';
COMMENT ON COLUMN agency_calls.secondary_original_filename IS 'Filename of the second audio file if this is a split call';
