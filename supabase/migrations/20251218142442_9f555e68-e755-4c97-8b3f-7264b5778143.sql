-- Add user_name column to store the name directly with the comment
ALTER TABLE public.training_comments 
ADD COLUMN IF NOT EXISTS user_name TEXT;