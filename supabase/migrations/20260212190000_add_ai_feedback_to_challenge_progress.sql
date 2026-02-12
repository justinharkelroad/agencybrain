-- Add ai_feedback column to challenge_progress
-- Stores structured AI-generated coaching feedback on reflection responses
-- Format: { headline, coaching_summary, relevance_score, pushback, highlight }

ALTER TABLE challenge_progress ADD COLUMN IF NOT EXISTS ai_feedback jsonb;
COMMENT ON COLUMN challenge_progress.ai_feedback IS 'AI-generated coaching feedback on reflection responses';
