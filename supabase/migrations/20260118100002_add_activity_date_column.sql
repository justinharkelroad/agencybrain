-- Add activity_date column to contact_activities table
-- This column represents when the activity occurred (may differ from created_at)

ALTER TABLE contact_activities
ADD COLUMN IF NOT EXISTS activity_date timestamptz NOT NULL DEFAULT now();

-- Backfill existing records with created_at value
UPDATE contact_activities
SET activity_date = created_at
WHERE activity_date IS NULL OR activity_date = now();

-- Add index for sorting by activity_date
CREATE INDEX IF NOT EXISTS idx_contact_activities_activity_date
ON contact_activities(contact_id, activity_date DESC);

COMMENT ON COLUMN contact_activities.activity_date IS 'When the activity occurred (may differ from created_at for backdated entries)';
