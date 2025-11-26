-- Drop the old constraint
ALTER TABLE training_quiz_questions 
DROP CONSTRAINT IF EXISTS training_quiz_questions_question_type_check;

-- Add updated constraint with text_response included
ALTER TABLE training_quiz_questions 
ADD CONSTRAINT training_quiz_questions_question_type_check 
CHECK (question_type = ANY (ARRAY['multiple_choice'::text, 'true_false'::text, 'select_all'::text, 'text_response'::text]));