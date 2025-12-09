-- Create update_updated_at function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- STANDARD PLAYBOOK TRAINING SYSTEM
-- =============================================

-- SP CATEGORIES
CREATE TABLE sp_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  icon text DEFAULT '📚',
  color text DEFAULT '#6366f1',
  access_tiers text[] NOT NULL DEFAULT '{}',
  display_order int DEFAULT 0,
  is_published boolean DEFAULT false,
  published_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- SP MODULES
CREATE TABLE sp_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES sp_categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  icon text DEFAULT '📦',
  display_order int DEFAULT 0,
  is_published boolean DEFAULT false,
  published_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(category_id, slug)
);

-- SP LESSONS
CREATE TABLE sp_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES sp_modules(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  video_url text,
  content_html text,
  document_url text,
  document_name text,
  display_order int DEFAULT 0,
  has_quiz boolean DEFAULT true,
  estimated_minutes int DEFAULT 10,
  is_published boolean DEFAULT false,
  published_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(module_id, slug)
);

-- SP QUIZZES
CREATE TABLE sp_quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid UNIQUE NOT NULL REFERENCES sp_lessons(id) ON DELETE CASCADE,
  questions_json jsonb NOT NULL DEFAULT '[]',
  pass_threshold int DEFAULT 70,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- SP PROGRESS (Agency Owners)
CREATE TABLE sp_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES sp_lessons(id) ON DELETE CASCADE,
  video_watched boolean DEFAULT false,
  content_viewed boolean DEFAULT false,
  document_downloaded boolean DEFAULT false,
  quiz_completed boolean DEFAULT false,
  quiz_score int,
  quiz_passed boolean DEFAULT false,
  quiz_answers_json jsonb,
  reflection_takeaway text,
  reflection_action text,
  reflection_result text,
  ai_summary text,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, lesson_id)
);

-- SP PROGRESS STAFF
CREATE TABLE sp_progress_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_user_id uuid NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES sp_lessons(id) ON DELETE CASCADE,
  video_watched boolean DEFAULT false,
  content_viewed boolean DEFAULT false,
  document_downloaded boolean DEFAULT false,
  quiz_completed boolean DEFAULT false,
  quiz_score int,
  quiz_passed boolean DEFAULT false,
  quiz_answers_json jsonb,
  reflection_takeaway text,
  reflection_action text,
  reflection_result text,
  ai_summary text,
  completion_email_sent boolean DEFAULT false,
  completion_email_sent_at timestamptz,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(staff_user_id, lesson_id)
);

-- INDEXES
CREATE INDEX idx_sp_categories_published ON sp_categories(is_published);
CREATE INDEX idx_sp_categories_order ON sp_categories(display_order);
CREATE INDEX idx_sp_modules_category ON sp_modules(category_id);
CREATE INDEX idx_sp_modules_order ON sp_modules(display_order);
CREATE INDEX idx_sp_lessons_module ON sp_lessons(module_id);
CREATE INDEX idx_sp_lessons_order ON sp_lessons(display_order);
CREATE INDEX idx_sp_progress_user ON sp_progress(user_id);
CREATE INDEX idx_sp_progress_lesson ON sp_progress(lesson_id);
CREATE INDEX idx_sp_progress_completed ON sp_progress(completed_at);
CREATE INDEX idx_sp_progress_staff_user ON sp_progress_staff(staff_user_id);
CREATE INDEX idx_sp_progress_staff_lesson ON sp_progress_staff(lesson_id);

-- RLS
ALTER TABLE sp_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE sp_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE sp_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE sp_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sp_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE sp_progress_staff ENABLE ROW LEVEL SECURITY;

-- CATEGORIES: Admin full access
CREATE POLICY "admin_all_sp_categories" ON sp_categories
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- CATEGORIES: Users see published categories matching their tier
CREATE POLICY "users_view_sp_categories" ON sp_categories
  FOR SELECT USING (
    is_published = true AND EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND (
        (p.membership_tier = 'Boardroom' AND 'boardroom' = ANY(access_tiers))
        OR (p.membership_tier = '1:1 Coaching' AND 'one_on_one' = ANY(access_tiers))
      )
    )
  );

-- MODULES: Admin full access
CREATE POLICY "admin_all_sp_modules" ON sp_modules
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- MODULES: Users see published modules
CREATE POLICY "users_view_sp_modules" ON sp_modules
  FOR SELECT USING (
    is_published = true AND EXISTS (
      SELECT 1 FROM sp_categories sc WHERE sc.id = category_id AND sc.is_published = true AND EXISTS (
        SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND (
          (p.membership_tier = 'Boardroom' AND 'boardroom' = ANY(sc.access_tiers))
          OR (p.membership_tier = '1:1 Coaching' AND 'one_on_one' = ANY(sc.access_tiers))
        )
      )
    )
  );

-- LESSONS: Admin full access
CREATE POLICY "admin_all_sp_lessons" ON sp_lessons
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- LESSONS: Users see published lessons
CREATE POLICY "users_view_sp_lessons" ON sp_lessons
  FOR SELECT USING (
    is_published = true AND EXISTS (
      SELECT 1 FROM sp_modules sm JOIN sp_categories sc ON sc.id = sm.category_id
      WHERE sm.id = module_id AND sm.is_published = true AND sc.is_published = true AND EXISTS (
        SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND (
          (p.membership_tier = 'Boardroom' AND 'boardroom' = ANY(sc.access_tiers))
          OR (p.membership_tier = '1:1 Coaching' AND 'one_on_one' = ANY(sc.access_tiers))
        )
      )
    )
  );

-- QUIZZES: Admin full access
CREATE POLICY "admin_all_sp_quizzes" ON sp_quizzes
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- QUIZZES: Users can view quizzes for accessible lessons
CREATE POLICY "users_view_sp_quizzes" ON sp_quizzes
  FOR SELECT USING (EXISTS (SELECT 1 FROM sp_lessons sl WHERE sl.id = lesson_id AND sl.is_published = true));

-- PROGRESS: Users own their progress
CREATE POLICY "users_own_sp_progress" ON sp_progress FOR ALL USING (user_id = auth.uid());

-- PROGRESS: Admin can view all
CREATE POLICY "admin_view_sp_progress" ON sp_progress
  FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- STAFF PROGRESS: Service role only
CREATE POLICY "service_role_sp_staff_progress" ON sp_progress_staff
  FOR ALL USING (auth.role() = 'service_role');

-- Admin can view staff progress
CREATE POLICY "admin_view_sp_staff_progress" ON sp_progress_staff
  FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- TRIGGERS
CREATE TRIGGER sp_categories_updated BEFORE UPDATE ON sp_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER sp_modules_updated BEFORE UPDATE ON sp_modules FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER sp_lessons_updated BEFORE UPDATE ON sp_lessons FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER sp_quizzes_updated BEFORE UPDATE ON sp_quizzes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER sp_progress_updated BEFORE UPDATE ON sp_progress FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER sp_progress_staff_updated BEFORE UPDATE ON sp_progress_staff FOR EACH ROW EXECUTE FUNCTION update_updated_at();