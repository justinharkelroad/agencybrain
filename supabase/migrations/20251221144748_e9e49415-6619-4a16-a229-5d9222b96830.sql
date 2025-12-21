-- Sync full_name from auth.users.raw_user_meta_data to profiles table
-- This fixes existing users who have names in auth but not in profiles

UPDATE profiles
SET full_name = auth.users.raw_user_meta_data->>'full_name'
FROM auth.users
WHERE profiles.id = auth.users.id
  AND profiles.full_name IS NULL
  AND auth.users.raw_user_meta_data->>'full_name' IS NOT NULL
  AND auth.users.raw_user_meta_data->>'full_name' != '';