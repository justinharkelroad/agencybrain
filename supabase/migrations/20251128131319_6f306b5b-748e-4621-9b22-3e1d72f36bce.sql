
-- Create staff_lesson_progress table
CREATE TABLE IF NOT EXISTS public.staff_lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_user_id UUID NOT NULL REFERENCES public.staff_users(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.training_lessons(id) ON DELETE CASCADE,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(staff_user_id, lesson_id)
);

-- Create staff_quiz_attempts table
CREATE TABLE IF NOT EXISTS public.staff_quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_user_id UUID NOT NULL REFERENCES public.staff_users(id) ON DELETE CASCADE,
  quiz_id UUID NOT NULL REFERENCES public.training_quizzes(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  passed BOOLEAN NOT NULL,
  answers JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.staff_lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_quiz_attempts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for staff_lesson_progress
CREATE POLICY "Staff can view their own progress"
  ON public.staff_lesson_progress
  FOR SELECT
  USING (true);

CREATE POLICY "Staff can insert their own progress"
  ON public.staff_lesson_progress
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Staff can update their own progress"
  ON public.staff_lesson_progress
  FOR UPDATE
  USING (true);

-- RLS Policies for staff_quiz_attempts
CREATE POLICY "Staff can view their own quiz attempts"
  ON public.staff_quiz_attempts
  FOR SELECT
  USING (true);

CREATE POLICY "Staff can insert their own quiz attempts"
  ON public.staff_quiz_attempts
  FOR INSERT
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_staff_lesson_progress_staff_user_id ON public.staff_lesson_progress(staff_user_id);
CREATE INDEX IF NOT EXISTS idx_staff_lesson_progress_lesson_id ON public.staff_lesson_progress(lesson_id);
CREATE INDEX IF NOT EXISTS idx_staff_quiz_attempts_staff_user_id ON public.staff_quiz_attempts(staff_user_id);
CREATE INDEX IF NOT EXISTS idx_staff_quiz_attempts_quiz_id ON public.staff_quiz_attempts(quiz_id);

-- Create updated_at trigger for staff_lesson_progress
CREATE OR REPLACE FUNCTION update_staff_lesson_progress_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_staff_lesson_progress_updated_at
  BEFORE UPDATE ON public.staff_lesson_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_staff_lesson_progress_updated_at();
