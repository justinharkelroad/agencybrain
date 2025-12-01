-- Add AI coaching feedback columns to training_quiz_attempts
ALTER TABLE training_quiz_attempts 
ADD COLUMN IF NOT EXISTS ai_feedback TEXT,
ADD COLUMN IF NOT EXISTS feedback_viewed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reflection_answers_final JSONB;