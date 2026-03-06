-- Add checklist_type to onboarding_training_items to support multiple checklist types
-- (onboarding, offboarding, etc.)
ALTER TABLE onboarding_training_items
  ADD COLUMN IF NOT EXISTS checklist_type text NOT NULL DEFAULT 'onboarding';

-- Index for efficient filtering by member + type
CREATE INDEX IF NOT EXISTS idx_oti_member_type
  ON onboarding_training_items (member_id, checklist_type);

NOTIFY pgrst, 'reload schema';
