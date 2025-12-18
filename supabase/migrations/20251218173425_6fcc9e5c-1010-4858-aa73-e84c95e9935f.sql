-- Drop the foreign key constraint on user_id that references auth.users
-- This allows staff users (who aren't in auth.users) to post comments
ALTER TABLE public.training_comments 
DROP CONSTRAINT IF EXISTS training_comments_user_id_fkey;