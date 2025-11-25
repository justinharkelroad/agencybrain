-- Phase 1: Training Module System - Database Schema & RLS Policies

-- =====================================================
-- 1. CREATE TABLES
-- =====================================================

-- 1.1 Training Categories
CREATE TABLE IF NOT EXISTS public.training_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid REFERENCES public.agencies(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_training_categories_agency ON public.training_categories(agency_id);
CREATE INDEX IF NOT EXISTS idx_training_categories_active ON public.training_categories(agency_id, is_active);

-- 1.2 Training Modules
CREATE TABLE IF NOT EXISTS public.training_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid REFERENCES public.agencies(id) ON DELETE CASCADE NOT NULL,
  category_id uuid REFERENCES public.training_categories(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  thumbnail_url text,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_training_modules_agency ON public.training_modules(agency_id);
CREATE INDEX IF NOT EXISTS idx_training_modules_category ON public.training_modules(category_id);

-- 1.3 Training Lessons
CREATE TABLE IF NOT EXISTS public.training_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid REFERENCES public.agencies(id) ON DELETE CASCADE NOT NULL,
  module_id uuid REFERENCES public.training_modules(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  video_url text,
  video_platform text CHECK (video_platform IN ('youtube', 'vimeo', 'loom', 'wistia') OR video_platform IS NULL),
  content_html text,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  estimated_duration_minutes integer CHECK (estimated_duration_minutes > 0 OR estimated_duration_minutes IS NULL),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_training_lessons_agency ON public.training_lessons(agency_id);
CREATE INDEX IF NOT EXISTS idx_training_lessons_module ON public.training_lessons(module_id);

-- 1.4 Training Attachments
CREATE TABLE IF NOT EXISTS public.training_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid REFERENCES public.agencies(id) ON DELETE CASCADE NOT NULL,
  lesson_id uuid REFERENCES public.training_lessons(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  file_type text NOT NULL CHECK (file_type IN ('pdf', 'doc', 'docx', 'mp3', 'mp4', 'link', 'wav', 'txt')),
  file_url text NOT NULL,
  file_size_bytes bigint CHECK (file_size_bytes > 0 OR file_size_bytes IS NULL),
  is_external_link boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_training_attachments_lesson ON public.training_attachments(lesson_id);

-- 1.5 Training Quizzes (one per lesson)
CREATE TABLE IF NOT EXISTS public.training_quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid REFERENCES public.agencies(id) ON DELETE CASCADE NOT NULL,
  lesson_id uuid REFERENCES public.training_lessons(id) ON DELETE CASCADE NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_training_quizzes_lesson ON public.training_quizzes(lesson_id);

-- 1.6 Training Quiz Questions
CREATE TABLE IF NOT EXISTS public.training_quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid REFERENCES public.training_quizzes(id) ON DELETE CASCADE NOT NULL,
  question_text text NOT NULL,
  question_type text NOT NULL CHECK (question_type IN ('multiple_choice', 'true_false', 'select_all')),
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_training_quiz_questions_quiz ON public.training_quiz_questions(quiz_id);

-- 1.7 Training Quiz Options
CREATE TABLE IF NOT EXISTS public.training_quiz_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid REFERENCES public.training_quiz_questions(id) ON DELETE CASCADE NOT NULL,
  option_text text NOT NULL,
  is_correct boolean DEFAULT false,
  sort_order integer DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_training_quiz_options_question ON public.training_quiz_options(question_id);

-- 1.8 Staff Users (separate auth system)
CREATE TABLE IF NOT EXISTS public.staff_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid REFERENCES public.agencies(id) ON DELETE CASCADE NOT NULL,
  username text NOT NULL,
  password_hash text NOT NULL,
  display_name text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  last_login_at timestamptz,
  UNIQUE(agency_id, username)
);

CREATE INDEX IF NOT EXISTS idx_staff_users_agency ON public.staff_users(agency_id);
CREATE INDEX IF NOT EXISTS idx_staff_users_username ON public.staff_users(agency_id, username);

-- 1.9 Training Assignments
CREATE TABLE IF NOT EXISTS public.training_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid REFERENCES public.agencies(id) ON DELETE CASCADE NOT NULL,
  staff_user_id uuid REFERENCES public.staff_users(id) ON DELETE CASCADE NOT NULL,
  module_id uuid REFERENCES public.training_modules(id) ON DELETE CASCADE NOT NULL,
  assigned_at timestamptz DEFAULT now() NOT NULL,
  due_date date,
  assigned_by uuid REFERENCES public.profiles(id),
  UNIQUE(staff_user_id, module_id)
);

CREATE INDEX IF NOT EXISTS idx_training_assignments_staff ON public.training_assignments(staff_user_id);
CREATE INDEX IF NOT EXISTS idx_training_assignments_module ON public.training_assignments(module_id);

-- 1.10 Training Lesson Progress
CREATE TABLE IF NOT EXISTS public.training_lesson_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid REFERENCES public.agencies(id) ON DELETE CASCADE NOT NULL,
  staff_user_id uuid REFERENCES public.staff_users(id) ON DELETE CASCADE NOT NULL,
  lesson_id uuid REFERENCES public.training_lessons(id) ON DELETE CASCADE NOT NULL,
  started_at timestamptz,
  completed_at timestamptz,
  is_completed boolean DEFAULT false,
  UNIQUE(staff_user_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS idx_training_lesson_progress_staff ON public.training_lesson_progress(staff_user_id);
CREATE INDEX IF NOT EXISTS idx_training_lesson_progress_lesson ON public.training_lesson_progress(lesson_id);

-- 1.11 Training Quiz Attempts
CREATE TABLE IF NOT EXISTS public.training_quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid REFERENCES public.agencies(id) ON DELETE CASCADE NOT NULL,
  staff_user_id uuid REFERENCES public.staff_users(id) ON DELETE CASCADE NOT NULL,
  quiz_id uuid REFERENCES public.training_quizzes(id) ON DELETE CASCADE NOT NULL,
  score_percent decimal(5,2) NOT NULL CHECK (score_percent >= 0 AND score_percent <= 100),
  total_questions integer NOT NULL CHECK (total_questions > 0),
  correct_answers integer NOT NULL CHECK (correct_answers >= 0),
  answers_json jsonb NOT NULL,
  started_at timestamptz NOT NULL,
  completed_at timestamptz NOT NULL,
  CHECK (completed_at >= started_at),
  CHECK (correct_answers <= total_questions)
);

CREATE INDEX IF NOT EXISTS idx_training_quiz_attempts_staff ON public.training_quiz_attempts(staff_user_id);
CREATE INDEX IF NOT EXISTS idx_training_quiz_attempts_quiz ON public.training_quiz_attempts(quiz_id);

-- =====================================================
-- 2. ENABLE RLS ON ALL TABLES
-- =====================================================

ALTER TABLE public.training_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_quiz_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_quiz_attempts ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 3. CREATE HELPER FUNCTION
-- =====================================================

-- Function to check if staff user is assigned to a module
CREATE OR REPLACE FUNCTION public.is_staff_assigned_to_module(p_staff_user_id uuid, p_module_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM training_assignments
    WHERE staff_user_id = p_staff_user_id 
      AND module_id = p_module_id
  );
$$;

-- =====================================================
-- 4. CREATE RLS POLICIES
-- =====================================================

-- 4.1 Training Categories Policies
CREATE POLICY "Agency users can view training categories"
  ON public.training_categories FOR SELECT
  USING (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Agency users can insert training categories"
  ON public.training_categories FOR INSERT
  WITH CHECK (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Agency users can update training categories"
  ON public.training_categories FOR UPDATE
  USING (has_agency_access(auth.uid(), agency_id))
  WITH CHECK (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Agency users can delete training categories"
  ON public.training_categories FOR DELETE
  USING (has_agency_access(auth.uid(), agency_id));

-- 4.2 Training Modules Policies
CREATE POLICY "Agency users can view training modules"
  ON public.training_modules FOR SELECT
  USING (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Agency users can insert training modules"
  ON public.training_modules FOR INSERT
  WITH CHECK (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Agency users can update training modules"
  ON public.training_modules FOR UPDATE
  USING (has_agency_access(auth.uid(), agency_id))
  WITH CHECK (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Agency users can delete training modules"
  ON public.training_modules FOR DELETE
  USING (has_agency_access(auth.uid(), agency_id));

-- 4.3 Training Lessons Policies
CREATE POLICY "Agency users can view training lessons"
  ON public.training_lessons FOR SELECT
  USING (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Agency users can insert training lessons"
  ON public.training_lessons FOR INSERT
  WITH CHECK (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Agency users can update training lessons"
  ON public.training_lessons FOR UPDATE
  USING (has_agency_access(auth.uid(), agency_id))
  WITH CHECK (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Agency users can delete training lessons"
  ON public.training_lessons FOR DELETE
  USING (has_agency_access(auth.uid(), agency_id));

-- 4.4 Training Attachments Policies
CREATE POLICY "Agency users can view training attachments"
  ON public.training_attachments FOR SELECT
  USING (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Agency users can insert training attachments"
  ON public.training_attachments FOR INSERT
  WITH CHECK (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Agency users can update training attachments"
  ON public.training_attachments FOR UPDATE
  USING (has_agency_access(auth.uid(), agency_id))
  WITH CHECK (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Agency users can delete training attachments"
  ON public.training_attachments FOR DELETE
  USING (has_agency_access(auth.uid(), agency_id));

-- 4.5 Training Quizzes Policies
CREATE POLICY "Agency users can view training quizzes"
  ON public.training_quizzes FOR SELECT
  USING (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Agency users can insert training quizzes"
  ON public.training_quizzes FOR INSERT
  WITH CHECK (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Agency users can update training quizzes"
  ON public.training_quizzes FOR UPDATE
  USING (has_agency_access(auth.uid(), agency_id))
  WITH CHECK (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Agency users can delete training quizzes"
  ON public.training_quizzes FOR DELETE
  USING (has_agency_access(auth.uid(), agency_id));

-- 4.6 Training Quiz Questions Policies
CREATE POLICY "Agency users can view quiz questions"
  ON public.training_quiz_questions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM training_quizzes tq
      WHERE tq.id = quiz_id AND has_agency_access(auth.uid(), tq.agency_id)
    )
  );

CREATE POLICY "Agency users can insert quiz questions"
  ON public.training_quiz_questions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM training_quizzes tq
      WHERE tq.id = quiz_id AND has_agency_access(auth.uid(), tq.agency_id)
    )
  );

CREATE POLICY "Agency users can update quiz questions"
  ON public.training_quiz_questions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM training_quizzes tq
      WHERE tq.id = quiz_id AND has_agency_access(auth.uid(), tq.agency_id)
    )
  );

CREATE POLICY "Agency users can delete quiz questions"
  ON public.training_quiz_questions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM training_quizzes tq
      WHERE tq.id = quiz_id AND has_agency_access(auth.uid(), tq.agency_id)
    )
  );

-- 4.7 Training Quiz Options Policies
CREATE POLICY "Agency users can view quiz options"
  ON public.training_quiz_options FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM training_quiz_questions tqq
      JOIN training_quizzes tq ON tq.id = tqq.quiz_id
      WHERE tqq.id = question_id AND has_agency_access(auth.uid(), tq.agency_id)
    )
  );

CREATE POLICY "Agency users can insert quiz options"
  ON public.training_quiz_options FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM training_quiz_questions tqq
      JOIN training_quizzes tq ON tq.id = tqq.quiz_id
      WHERE tqq.id = question_id AND has_agency_access(auth.uid(), tq.agency_id)
    )
  );

CREATE POLICY "Agency users can update quiz options"
  ON public.training_quiz_options FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM training_quiz_questions tqq
      JOIN training_quizzes tq ON tq.id = tqq.quiz_id
      WHERE tqq.id = question_id AND has_agency_access(auth.uid(), tq.agency_id)
    )
  );

CREATE POLICY "Agency users can delete quiz options"
  ON public.training_quiz_options FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM training_quiz_questions tqq
      JOIN training_quizzes tq ON tq.id = tqq.quiz_id
      WHERE tqq.id = question_id AND has_agency_access(auth.uid(), tq.agency_id)
    )
  );

-- 4.8 Staff Users Policies
CREATE POLICY "Agency users can view staff users"
  ON public.staff_users FOR SELECT
  USING (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Agency users can insert staff users"
  ON public.staff_users FOR INSERT
  WITH CHECK (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Agency users can update staff users"
  ON public.staff_users FOR UPDATE
  USING (has_agency_access(auth.uid(), agency_id))
  WITH CHECK (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Agency users can delete staff users"
  ON public.staff_users FOR DELETE
  USING (has_agency_access(auth.uid(), agency_id));

-- 4.9 Training Assignments Policies
CREATE POLICY "Agency users can view training assignments"
  ON public.training_assignments FOR SELECT
  USING (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Agency users can insert training assignments"
  ON public.training_assignments FOR INSERT
  WITH CHECK (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Agency users can update training assignments"
  ON public.training_assignments FOR UPDATE
  USING (has_agency_access(auth.uid(), agency_id))
  WITH CHECK (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Agency users can delete training assignments"
  ON public.training_assignments FOR DELETE
  USING (has_agency_access(auth.uid(), agency_id));

-- 4.10 Training Lesson Progress Policies
CREATE POLICY "Agency users can view lesson progress"
  ON public.training_lesson_progress FOR SELECT
  USING (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Agency users can insert lesson progress"
  ON public.training_lesson_progress FOR INSERT
  WITH CHECK (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Agency users can update lesson progress"
  ON public.training_lesson_progress FOR UPDATE
  USING (has_agency_access(auth.uid(), agency_id))
  WITH CHECK (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Agency users can delete lesson progress"
  ON public.training_lesson_progress FOR DELETE
  USING (has_agency_access(auth.uid(), agency_id));

-- 4.11 Training Quiz Attempts Policies
CREATE POLICY "Agency users can view quiz attempts"
  ON public.training_quiz_attempts FOR SELECT
  USING (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Agency users can insert quiz attempts"
  ON public.training_quiz_attempts FOR INSERT
  WITH CHECK (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Agency users can update quiz attempts"
  ON public.training_quiz_attempts FOR UPDATE
  USING (has_agency_access(auth.uid(), agency_id))
  WITH CHECK (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Agency users can delete quiz attempts"
  ON public.training_quiz_attempts FOR DELETE
  USING (has_agency_access(auth.uid(), agency_id));

-- =====================================================
-- 5. CREATE STORAGE BUCKET
-- =====================================================

-- Insert training-files bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'training-files',
  'training-files',
  false,
  52428800, -- 50MB in bytes
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'audio/mpeg',
    'audio/wav',
    'video/mp4',
    'text/plain'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Storage bucket RLS policies
CREATE POLICY "Agency users can view training files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'training-files' 
    AND has_agency_access(auth.uid(), (storage.foldername(name))[1]::uuid)
  );

CREATE POLICY "Agency users can upload training files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'training-files'
    AND has_agency_access(auth.uid(), (storage.foldername(name))[1]::uuid)
  );

CREATE POLICY "Agency users can update training files"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'training-files'
    AND has_agency_access(auth.uid(), (storage.foldername(name))[1]::uuid)
  );

CREATE POLICY "Agency users can delete training files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'training-files'
    AND has_agency_access(auth.uid(), (storage.foldername(name))[1]::uuid)
  );

-- =====================================================
-- 6. CREATE UPDATE TRIGGERS
-- =====================================================

CREATE TRIGGER update_training_categories_updated_at
  BEFORE UPDATE ON public.training_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_training_modules_updated_at
  BEFORE UPDATE ON public.training_modules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_training_lessons_updated_at
  BEFORE UPDATE ON public.training_lessons
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_training_quizzes_updated_at
  BEFORE UPDATE ON public.training_quizzes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_staff_users_updated_at
  BEFORE UPDATE ON public.staff_users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();