-- Add thumbnail_url column to training_lessons table
ALTER TABLE training_lessons ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;