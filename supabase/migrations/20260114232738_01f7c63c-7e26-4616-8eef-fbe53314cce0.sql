-- Drop the foreign key constraint on last_activity_by to allow staff user IDs
ALTER TABLE renewal_records 
DROP CONSTRAINT IF EXISTS renewal_records_last_activity_by_fkey;