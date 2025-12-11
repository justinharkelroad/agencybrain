-- Drop the current global unique constraint on staff_users email
DROP INDEX IF EXISTS idx_staff_users_email;

-- Create new partial unique index (only enforces uniqueness among ACTIVE users)
-- This allows deactivated staff user emails to be reused
CREATE UNIQUE INDEX idx_staff_users_email_active 
ON staff_users(email) 
WHERE is_active = true;