-- Add 'moved_to_quoted' status to winback_households
-- This status indicates the contact agreed to get a quote and was moved to LQS quoted flow

-- Drop the existing check constraint (auto-generated name format)
ALTER TABLE winback_households
DROP CONSTRAINT IF EXISTS winback_households_status_check;

-- Add the updated check constraint with new status
ALTER TABLE winback_households
ADD CONSTRAINT winback_households_status_check
CHECK (status IN ('untouched', 'in_progress', 'won_back', 'declined', 'no_contact', 'dismissed', 'moved_to_quoted'));

COMMENT ON COLUMN winback_households.status IS 'untouched=not contacted, in_progress=being worked, won_back=re-purchased, declined=not interested, no_contact=unreachable, dismissed=gave up, moved_to_quoted=agreed to quote and moved to LQS';
