-- Backfill existing comments with agency name where full_name is null
UPDATE public.training_comments tc
SET user_name = COALESCE(
  (SELECT p.full_name FROM profiles p WHERE p.id = tc.user_id),
  (SELECT a.name FROM agencies a 
   JOIN profiles p ON p.agency_id = a.id 
   WHERE p.id = tc.user_id),
  SPLIT_PART((SELECT email FROM auth.users WHERE id = tc.user_id), '@', 1),
  tc.user_name
)
WHERE user_name IS NULL 
   OR user_name = 'Anonymous' 
   OR user_name LIKE '%@%'
   OR user_name = 'agencybraintester';