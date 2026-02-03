-- Migration: Add adhoc task support
-- Allows standalone follow-up tasks not tied to an onboarding instance

-- Make instance_id nullable for adhoc tasks
ALTER TABLE onboarding_tasks ALTER COLUMN instance_id DROP NOT NULL;

-- Add adhoc flag column
ALTER TABLE onboarding_tasks ADD COLUMN IF NOT EXISTS is_adhoc BOOLEAN NOT NULL DEFAULT false;

-- Add parent task reference (for follow-ups spawned from completing another task)
ALTER TABLE onboarding_tasks ADD COLUMN IF NOT EXISTS parent_task_id UUID REFERENCES onboarding_tasks(id) ON DELETE SET NULL;

-- Add contact_id directly on task for adhoc tasks (since they don't have instance)
ALTER TABLE onboarding_tasks ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES agency_contacts(id) ON DELETE SET NULL;

-- Ensure task has either instance_id OR is_adhoc (with contact_id)
ALTER TABLE onboarding_tasks ADD CONSTRAINT task_instance_or_adhoc
  CHECK (
    (instance_id IS NOT NULL AND is_adhoc = false) OR
    (is_adhoc = true AND contact_id IS NOT NULL)
  );

-- Index for efficient adhoc task queries
CREATE INDEX IF NOT EXISTS idx_onboarding_tasks_adhoc
  ON onboarding_tasks(agency_id, is_adhoc, status)
  WHERE is_adhoc = true;

-- Index for parent task lookups
CREATE INDEX IF NOT EXISTS idx_onboarding_tasks_parent
  ON onboarding_tasks(parent_task_id)
  WHERE parent_task_id IS NOT NULL;

-- Update existing rows to set is_adhoc = false explicitly (default already does this, but be safe)
UPDATE onboarding_tasks SET is_adhoc = false WHERE is_adhoc IS NULL;

COMMENT ON COLUMN onboarding_tasks.is_adhoc IS 'True for standalone follow-up tasks not tied to a sequence instance';
COMMENT ON COLUMN onboarding_tasks.parent_task_id IS 'References the task that spawned this follow-up task';
COMMENT ON COLUMN onboarding_tasks.contact_id IS 'Direct contact reference for adhoc tasks (since they lack an instance)';
