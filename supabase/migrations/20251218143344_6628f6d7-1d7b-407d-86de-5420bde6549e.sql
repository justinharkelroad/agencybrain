-- Update existing anonymous comments to use email prefix from auth.users
UPDATE public.training_comments tc
SET user_name = (
  SELECT SPLIT_PART(email, '@', 1)
  FROM auth.users 
  WHERE id = tc.user_id
)
WHERE user_name IS NULL OR user_name = 'Anonymous';