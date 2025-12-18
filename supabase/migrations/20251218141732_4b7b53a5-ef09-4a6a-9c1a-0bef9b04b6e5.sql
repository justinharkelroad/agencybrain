-- Drop the foreign key constraint that references training_lessons
-- Comments can be on either training_lessons OR sp_lessons
ALTER TABLE public.training_comments
DROP CONSTRAINT IF EXISTS training_comments_lesson_id_fkey;