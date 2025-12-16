-- Drop the existing unique constraint on (agency_id, username)
ALTER TABLE staff_users DROP CONSTRAINT IF EXISTS staff_users_agency_id_username_key;

-- Create partial unique index (only enforces uniqueness among active users)
-- This allows deactivated usernames to be reused
CREATE UNIQUE INDEX staff_users_agency_id_username_active 
ON staff_users(agency_id, username) 
WHERE is_active = true;