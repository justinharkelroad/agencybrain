-- Drop existing constraint and add new one with updated values
ALTER TABLE renewal_activities DROP CONSTRAINT IF EXISTS renewal_activities_activity_type_check;

ALTER TABLE renewal_activities ADD CONSTRAINT renewal_activities_activity_type_check 
CHECK (activity_type IN ('phone_call', 'appointment', 'email', 'note', 'status_change', 'call', 'voicemail', 'text', 'review_done'));