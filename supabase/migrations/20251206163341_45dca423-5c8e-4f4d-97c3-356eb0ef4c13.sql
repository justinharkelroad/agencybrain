-- Add profile_photo_url column to staff_users table
ALTER TABLE staff_users 
ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;