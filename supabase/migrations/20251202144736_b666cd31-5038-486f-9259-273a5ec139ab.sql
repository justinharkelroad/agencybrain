-- Add snapshot columns for preserving quiz context when training content is deleted
ALTER TABLE training_quiz_attempts
ADD COLUMN IF NOT EXISTS quiz_name TEXT,
ADD COLUMN IF NOT EXISTS lesson_name TEXT,
ADD COLUMN IF NOT EXISTS module_name TEXT,
ADD COLUMN IF NOT EXISTS category_name TEXT;

-- Add snapshot column for staff_lesson_progress
ALTER TABLE staff_lesson_progress
ADD COLUMN IF NOT EXISTS lesson_name TEXT,
ADD COLUMN IF NOT EXISTS module_name TEXT;

-- Backfill existing quiz attempts with current names
UPDATE training_quiz_attempts tqa
SET 
  quiz_name = tq.name,
  lesson_name = tl.name,
  module_name = tm.name,
  category_name = tc.name
FROM training_quizzes tq
JOIN training_lessons tl ON tq.lesson_id = tl.id
JOIN training_modules tm ON tl.module_id = tm.id
JOIN training_categories tc ON tm.category_id = tc.id
WHERE tqa.quiz_id = tq.id
  AND tqa.quiz_name IS NULL;

-- Backfill existing lesson progress with current names
UPDATE staff_lesson_progress slp
SET 
  lesson_name = tl.name,
  module_name = tm.name
FROM training_lessons tl
JOIN training_modules tm ON tl.module_id = tm.id
WHERE slp.lesson_id = tl.id
  AND slp.lesson_name IS NULL;

-- Drop existing CASCADE FK on training_quiz_attempts
ALTER TABLE training_quiz_attempts
DROP CONSTRAINT IF EXISTS training_quiz_attempts_quiz_id_fkey;

-- Make quiz_id nullable to allow SET NULL
ALTER TABLE training_quiz_attempts
ALTER COLUMN quiz_id DROP NOT NULL;

-- Add new FK with SET NULL behavior
ALTER TABLE training_quiz_attempts
ADD CONSTRAINT training_quiz_attempts_quiz_id_fkey
FOREIGN KEY (quiz_id) REFERENCES training_quizzes(id) ON DELETE SET NULL;

-- Drop existing CASCADE FK on staff_lesson_progress
ALTER TABLE staff_lesson_progress
DROP CONSTRAINT IF EXISTS staff_lesson_progress_lesson_id_fkey;

-- Make lesson_id nullable to allow SET NULL
ALTER TABLE staff_lesson_progress
ALTER COLUMN lesson_id DROP NOT NULL;

-- Add new FK with SET NULL behavior
ALTER TABLE staff_lesson_progress
ADD CONSTRAINT staff_lesson_progress_lesson_id_fkey
FOREIGN KEY (lesson_id) REFERENCES training_lessons(id) ON DELETE SET NULL;