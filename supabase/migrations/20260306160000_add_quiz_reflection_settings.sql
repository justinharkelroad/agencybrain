-- Add reflection toggle and custom question text to training_quizzes
-- Allows agency owners to toggle off the default reflection questions
-- and customize the question text when enabled.
ALTER TABLE training_quizzes
  ADD COLUMN include_reflections boolean NOT NULL DEFAULT true,
  ADD COLUMN reflection_question_1 text,
  ADD COLUMN reflection_question_2 text;

COMMENT ON COLUMN training_quizzes.include_reflections IS 'Whether to show reflection questions after the quiz';
COMMENT ON COLUMN training_quizzes.reflection_question_1 IS 'Custom text for reflection Q1 (NULL = use default)';
COMMENT ON COLUMN training_quizzes.reflection_question_2 IS 'Custom text for reflection Q2 (NULL = use default)';
