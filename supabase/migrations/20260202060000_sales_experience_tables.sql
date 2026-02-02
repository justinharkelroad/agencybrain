-- =====================================================
-- 8-Week Sales Experience Coaching Program
-- Migration: Tables, Functions, Triggers, and Seed Data
-- =====================================================

-- =====================================================
-- 1. ENUMS
-- =====================================================

-- Sales Experience assignment status
DO $$ BEGIN
  CREATE TYPE public.sales_experience_assignment_status AS ENUM ('pending', 'active', 'paused', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Sales Experience progress status
DO $$ BEGIN
  CREATE TYPE public.sales_experience_progress_status AS ENUM ('locked', 'available', 'in_progress', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Sales Experience email status
DO $$ BEGIN
  CREATE TYPE public.sales_experience_email_status AS ENUM ('pending', 'sent', 'failed', 'skipped');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Sales Experience message sender type
DO $$ BEGIN
  CREATE TYPE public.sales_experience_sender_type AS ENUM ('coach', 'owner', 'manager');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Sales Experience pillar type
DO $$ BEGIN
  CREATE TYPE public.sales_experience_pillar AS ENUM ('sales_process', 'accountability', 'coaching_cadence');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Sales Experience resource file type
DO $$ BEGIN
  CREATE TYPE public.sales_experience_file_type AS ENUM ('pdf', 'doc', 'video', 'link');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =====================================================
-- 2. TABLES
-- =====================================================

-- 2.1 Sales Experience Assignments - Agency enrollment in the 8-week program
CREATE TABLE IF NOT EXISTS public.sales_experience_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL, -- Admin who assigned
  -- Dates
  start_date date NOT NULL, -- Must be a Monday
  end_date date GENERATED ALWAYS AS (start_date + INTERVAL '55 days') STORED, -- 8 weeks = 56 days
  timezone text NOT NULL DEFAULT 'America/New_York',
  -- Status
  status public.sales_experience_assignment_status NOT NULL DEFAULT 'pending',
  -- Notes
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Constraint: Only one active assignment per agency at a time
  CONSTRAINT one_active_per_agency UNIQUE (agency_id, status) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX IF NOT EXISTS idx_se_assignments_agency ON public.sales_experience_assignments(agency_id);
CREATE INDEX IF NOT EXISTS idx_se_assignments_status ON public.sales_experience_assignments(status);
CREATE INDEX IF NOT EXISTS idx_se_assignments_dates ON public.sales_experience_assignments(start_date, end_date);

-- 2.2 Sales Experience Modules - 8 weeks of content
CREATE TABLE IF NOT EXISTS public.sales_experience_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_number integer NOT NULL CHECK (week_number >= 1 AND week_number <= 8) UNIQUE,
  title text NOT NULL,
  description text,
  pillar public.sales_experience_pillar NOT NULL,
  icon text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_se_modules_week ON public.sales_experience_modules(week_number);
CREATE INDEX IF NOT EXISTS idx_se_modules_pillar ON public.sales_experience_modules(pillar);

-- 2.3 Sales Experience Lessons - 3 per week (Mon/Wed/Fri) = 24 total
CREATE TABLE IF NOT EXISTS public.sales_experience_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES public.sales_experience_modules(id) ON DELETE CASCADE,
  -- Scheduling
  day_of_week integer NOT NULL CHECK (day_of_week IN (1, 3, 5)), -- 1=Mon, 3=Wed, 5=Fri
  -- Content
  title text NOT NULL,
  description text,
  video_url text,
  video_platform text DEFAULT 'vimeo', -- vimeo, youtube, etc.
  video_thumbnail_url text,
  content_html text,
  -- Quiz questions (JSONB for flexibility)
  quiz_questions jsonb DEFAULT '[]'::jsonb,
  -- Visibility
  is_staff_visible boolean NOT NULL DEFAULT true, -- Staff can see this lesson
  is_owner_only boolean NOT NULL DEFAULT false, -- Only visible to owner/manager
  -- Metadata
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(module_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_se_lessons_module ON public.sales_experience_lessons(module_id);
CREATE INDEX IF NOT EXISTS idx_se_lessons_staff ON public.sales_experience_lessons(is_staff_visible);

-- 2.4 Sales Experience Resources - Documents per module
CREATE TABLE IF NOT EXISTS public.sales_experience_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES public.sales_experience_modules(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  file_type public.sales_experience_file_type NOT NULL,
  storage_path text, -- Supabase storage path
  external_url text, -- External link
  is_staff_visible boolean NOT NULL DEFAULT false, -- Most docs are owner-only
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_se_resources_module ON public.sales_experience_resources(module_id);

-- 2.5 Sales Experience Transcripts - Zoom meeting transcripts
CREATE TABLE IF NOT EXISTS public.sales_experience_transcripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.sales_experience_assignments(id) ON DELETE CASCADE,
  week_number integer NOT NULL CHECK (week_number >= 1 AND week_number <= 8),
  meeting_date date NOT NULL,
  -- Content
  transcript_text text NOT NULL,
  summary_ai text, -- AI-generated summary
  action_items_json jsonb DEFAULT '[]'::jsonb, -- AI-extracted action items
  key_points_json jsonb DEFAULT '[]'::jsonb, -- AI-extracted key points
  -- Metadata
  uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(assignment_id, week_number)
);

CREATE INDEX IF NOT EXISTS idx_se_transcripts_assignment ON public.sales_experience_transcripts(assignment_id);
CREATE INDEX IF NOT EXISTS idx_se_transcripts_week ON public.sales_experience_transcripts(assignment_id, week_number);

-- 2.6 Sales Experience AI Prompts - Admin-editable AI prompts
CREATE TABLE IF NOT EXISTS public.sales_experience_ai_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_key text NOT NULL UNIQUE, -- 'transcript_summary', 'quiz_feedback', etc.
  prompt_name text NOT NULL, -- Human-readable name
  prompt_template text NOT NULL, -- The actual prompt with {{variables}}
  model_preference text DEFAULT 'claude-3-haiku', -- Preferred model
  description text, -- Admin documentation
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_se_ai_prompts_key ON public.sales_experience_ai_prompts(prompt_key);

-- 2.7 Sales Experience Owner Progress - Owner/Manager lesson tracking
CREATE TABLE IF NOT EXISTS public.sales_experience_owner_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.sales_experience_assignments(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.sales_experience_lessons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Status
  status public.sales_experience_progress_status NOT NULL DEFAULT 'available',
  -- Timestamps
  started_at timestamptz,
  completed_at timestamptz,
  -- Video tracking
  video_watched_seconds integer DEFAULT 0,
  video_completed boolean DEFAULT false,
  -- Notes
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(assignment_id, lesson_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_se_owner_progress_assignment ON public.sales_experience_owner_progress(assignment_id);
CREATE INDEX IF NOT EXISTS idx_se_owner_progress_user ON public.sales_experience_owner_progress(user_id);

-- 2.8 Sales Experience Staff Progress - Staff lesson tracking with time-gating
CREATE TABLE IF NOT EXISTS public.sales_experience_staff_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.sales_experience_assignments(id) ON DELETE CASCADE,
  staff_user_id uuid NOT NULL REFERENCES public.staff_users(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.sales_experience_lessons(id) ON DELETE CASCADE,
  -- Status
  status public.sales_experience_progress_status NOT NULL DEFAULT 'locked',
  -- Timestamps
  unlocked_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  -- Video tracking
  video_watched_seconds integer DEFAULT 0,
  video_completed boolean DEFAULT false,
  -- Quiz
  quiz_score_percent integer CHECK (quiz_score_percent >= 0 AND quiz_score_percent <= 100),
  quiz_feedback_ai text,
  quiz_completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(assignment_id, staff_user_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS idx_se_staff_progress_assignment ON public.sales_experience_staff_progress(assignment_id);
CREATE INDEX IF NOT EXISTS idx_se_staff_progress_staff ON public.sales_experience_staff_progress(staff_user_id);
CREATE INDEX IF NOT EXISTS idx_se_staff_progress_status ON public.sales_experience_staff_progress(status);

-- 2.9 Sales Experience Quiz Attempts - Staff quiz history
CREATE TABLE IF NOT EXISTS public.sales_experience_quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.sales_experience_assignments(id) ON DELETE CASCADE,
  staff_user_id uuid NOT NULL REFERENCES public.staff_users(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.sales_experience_lessons(id) ON DELETE CASCADE,
  -- Attempt data
  attempt_number integer NOT NULL DEFAULT 1,
  answers_json jsonb NOT NULL,
  score_percent integer NOT NULL CHECK (score_percent >= 0 AND score_percent <= 100),
  feedback_ai text,
  -- Timestamps
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_se_quiz_attempts_assignment ON public.sales_experience_quiz_attempts(assignment_id);
CREATE INDEX IF NOT EXISTS idx_se_quiz_attempts_staff ON public.sales_experience_quiz_attempts(staff_user_id);
CREATE INDEX IF NOT EXISTS idx_se_quiz_attempts_lesson ON public.sales_experience_quiz_attempts(lesson_id);

-- 2.10 Sales Experience Messages - Coach to Agency messaging
CREATE TABLE IF NOT EXISTS public.sales_experience_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.sales_experience_assignments(id) ON DELETE CASCADE,
  sender_type public.sales_experience_sender_type NOT NULL,
  sender_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Content
  content text NOT NULL,
  -- Attachments (optional)
  attachments_json jsonb DEFAULT '[]'::jsonb,
  -- Read tracking
  read_at timestamptz,
  read_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_se_messages_assignment ON public.sales_experience_messages(assignment_id);
CREATE INDEX IF NOT EXISTS idx_se_messages_sender ON public.sales_experience_messages(sender_user_id);
CREATE INDEX IF NOT EXISTS idx_se_messages_unread ON public.sales_experience_messages(assignment_id, read_at) WHERE read_at IS NULL;

-- 2.11 Sales Experience Email Templates - Editable email templates
CREATE TABLE IF NOT EXISTS public.sales_experience_email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text NOT NULL UNIQUE, -- 'lesson_available', 'quiz_completed', 'weekly_summary'
  template_name text NOT NULL,
  subject_template text NOT NULL, -- Subject with {{variables}}
  body_template text NOT NULL, -- HTML body with {{variables}}
  variables_available jsonb NOT NULL DEFAULT '[]'::jsonb, -- Available variables
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_se_email_templates_key ON public.sales_experience_email_templates(template_key);

-- 2.12 Sales Experience Email Queue - Scheduled emails
CREATE TABLE IF NOT EXISTS public.sales_experience_email_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.sales_experience_assignments(id) ON DELETE CASCADE,
  template_key text NOT NULL,
  -- Recipient info
  recipient_email text NOT NULL,
  recipient_name text,
  recipient_type text NOT NULL DEFAULT 'staff', -- 'staff', 'owner', 'manager'
  -- Scheduling
  scheduled_for timestamptz NOT NULL,
  -- Content (generated from template + variables)
  email_subject text NOT NULL,
  email_body_html text,
  variables_json jsonb DEFAULT '{}'::jsonb,
  -- Status
  status public.sales_experience_email_status NOT NULL DEFAULT 'pending',
  sent_at timestamptz,
  -- Error handling
  resend_message_id text,
  error_message text,
  retry_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_se_email_queue_assignment ON public.sales_experience_email_queue(assignment_id);
CREATE INDEX IF NOT EXISTS idx_se_email_queue_status ON public.sales_experience_email_queue(status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_se_email_queue_scheduled ON public.sales_experience_email_queue(scheduled_for) WHERE status = 'pending';

-- =====================================================
-- 3. HELPER FUNCTIONS
-- =====================================================

-- 3.1 Get business day number (excludes weekends) - reuse pattern from challenge
CREATE OR REPLACE FUNCTION public.get_sales_experience_business_day(
  p_start_date date,
  p_check_date date
)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_business_days integer := 0;
  v_current_date date := p_start_date;
BEGIN
  -- If check date is before start date, return 0
  IF p_check_date < p_start_date THEN
    RETURN 0;
  END IF;

  -- Count business days (Mon-Fri)
  WHILE v_current_date <= p_check_date LOOP
    -- Check if current date is a weekday (1=Mon, 7=Sun in ISO)
    IF EXTRACT(ISODOW FROM v_current_date) <= 5 THEN
      v_business_days := v_business_days + 1;
    END IF;
    v_current_date := v_current_date + 1;
  END LOOP;

  RETURN v_business_days;
END;
$$;

-- 3.2 Check if a Sales Experience lesson is unlocked for staff
-- Mon (day_of_week=1) unlocks on business day 1 of week
-- Wed (day_of_week=3) unlocks on business day 3 of week
-- Fri (day_of_week=5) unlocks on business day 5 of week
CREATE OR REPLACE FUNCTION public.is_sales_experience_lesson_unlocked(
  p_assignment_id uuid,
  p_lesson_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_assignment record;
  v_lesson record;
  v_business_day integer;
  v_current_week integer;
  v_day_in_week integer;
  v_lesson_unlock_business_day integer;
BEGIN
  -- Get assignment details
  SELECT start_date, status INTO v_assignment
  FROM public.sales_experience_assignments
  WHERE id = p_assignment_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Assignment must be active
  IF v_assignment.status != 'active' THEN
    RETURN false;
  END IF;

  -- Get lesson details
  SELECT sel.day_of_week, sem.week_number INTO v_lesson
  FROM public.sales_experience_lessons sel
  JOIN public.sales_experience_modules sem ON sem.id = sel.module_id
  WHERE sel.id = p_lesson_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Calculate current business day (1-indexed)
  v_business_day := public.get_sales_experience_business_day(v_assignment.start_date, CURRENT_DATE);

  -- Calculate which week we're in (1-indexed)
  v_current_week := GREATEST(1, CEIL(v_business_day::numeric / 5));

  -- Calculate day position within current week (1-5)
  v_day_in_week := ((v_business_day - 1) % 5) + 1;

  -- If we're past this lesson's week, it's unlocked
  IF v_current_week > v_lesson.week_number THEN
    RETURN true;
  END IF;

  -- If we're before this lesson's week, it's locked
  IF v_current_week < v_lesson.week_number THEN
    RETURN false;
  END IF;

  -- We're in the same week - check day_of_week
  -- Mon=1 unlocks on day 1, Wed=3 unlocks on day 3, Fri=5 unlocks on day 5
  RETURN v_day_in_week >= v_lesson.day_of_week;
END;
$$;

-- 3.3 Get current week number for an assignment
CREATE OR REPLACE FUNCTION public.get_sales_experience_current_week(
  p_assignment_id uuid
)
RETURNS integer
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_assignment record;
  v_business_day integer;
BEGIN
  SELECT start_date, status INTO v_assignment
  FROM public.sales_experience_assignments
  WHERE id = p_assignment_id;

  IF NOT FOUND OR v_assignment.status NOT IN ('active', 'completed') THEN
    RETURN 0;
  END IF;

  v_business_day := public.get_sales_experience_business_day(v_assignment.start_date, CURRENT_DATE);

  -- Week 1 = days 1-5, Week 2 = days 6-10, etc.
  RETURN LEAST(8, GREATEST(1, CEIL(v_business_day::numeric / 5)));
END;
$$;

-- 3.4 Check if user has sales experience access (owner/manager of agency with active assignment)
CREATE OR REPLACE FUNCTION public.has_sales_experience_access(
  p_user_id uuid,
  p_agency_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_profile record;
  v_agency_id uuid;
BEGIN
  -- Get user's profile and agency
  SELECT id, agency_id, role INTO v_profile
  FROM public.profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Use provided agency_id or fall back to user's agency
  v_agency_id := COALESCE(p_agency_id, v_profile.agency_id);

  IF v_agency_id IS NULL THEN
    RETURN false;
  END IF;

  -- Must be owner, manager, or admin
  IF v_profile.role NOT IN ('admin', 'agency_owner', 'key_employee') THEN
    RETURN false;
  END IF;

  -- Check if agency has an active/pending assignment
  RETURN EXISTS (
    SELECT 1 FROM public.sales_experience_assignments
    WHERE agency_id = v_agency_id
      AND status IN ('pending', 'active')
  );
END;
$$;

-- =====================================================
-- 4. TRIGGERS
-- =====================================================

-- 4.1 Updated_at trigger for all sales experience tables
CREATE OR REPLACE FUNCTION public.update_sales_experience_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Apply updated_at triggers to all tables that have updated_at
DROP TRIGGER IF EXISTS update_se_assignments_updated_at ON public.sales_experience_assignments;
CREATE TRIGGER update_se_assignments_updated_at
BEFORE UPDATE ON public.sales_experience_assignments
FOR EACH ROW EXECUTE FUNCTION public.update_sales_experience_updated_at();

DROP TRIGGER IF EXISTS update_se_modules_updated_at ON public.sales_experience_modules;
CREATE TRIGGER update_se_modules_updated_at
BEFORE UPDATE ON public.sales_experience_modules
FOR EACH ROW EXECUTE FUNCTION public.update_sales_experience_updated_at();

DROP TRIGGER IF EXISTS update_se_lessons_updated_at ON public.sales_experience_lessons;
CREATE TRIGGER update_se_lessons_updated_at
BEFORE UPDATE ON public.sales_experience_lessons
FOR EACH ROW EXECUTE FUNCTION public.update_sales_experience_updated_at();

DROP TRIGGER IF EXISTS update_se_resources_updated_at ON public.sales_experience_resources;
CREATE TRIGGER update_se_resources_updated_at
BEFORE UPDATE ON public.sales_experience_resources
FOR EACH ROW EXECUTE FUNCTION public.update_sales_experience_updated_at();

DROP TRIGGER IF EXISTS update_se_transcripts_updated_at ON public.sales_experience_transcripts;
CREATE TRIGGER update_se_transcripts_updated_at
BEFORE UPDATE ON public.sales_experience_transcripts
FOR EACH ROW EXECUTE FUNCTION public.update_sales_experience_updated_at();

DROP TRIGGER IF EXISTS update_se_owner_progress_updated_at ON public.sales_experience_owner_progress;
CREATE TRIGGER update_se_owner_progress_updated_at
BEFORE UPDATE ON public.sales_experience_owner_progress
FOR EACH ROW EXECUTE FUNCTION public.update_sales_experience_updated_at();

DROP TRIGGER IF EXISTS update_se_staff_progress_updated_at ON public.sales_experience_staff_progress;
CREATE TRIGGER update_se_staff_progress_updated_at
BEFORE UPDATE ON public.sales_experience_staff_progress
FOR EACH ROW EXECUTE FUNCTION public.update_sales_experience_updated_at();

DROP TRIGGER IF EXISTS update_se_email_queue_updated_at ON public.sales_experience_email_queue;
CREATE TRIGGER update_se_email_queue_updated_at
BEFORE UPDATE ON public.sales_experience_email_queue
FOR EACH ROW EXECUTE FUNCTION public.update_sales_experience_updated_at();

-- 4.2 Initialize staff progress when assignment becomes active
CREATE OR REPLACE FUNCTION public.initialize_sales_experience_staff_progress()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_staff record;
  v_lesson record;
BEGIN
  -- Only run when status changes to 'active'
  IF NEW.status != 'active' OR (OLD IS NOT NULL AND OLD.status = 'active') THEN
    RETURN NEW;
  END IF;

  -- Get all staff users for this agency
  FOR v_staff IN
    SELECT su.id
    FROM public.staff_users su
    JOIN public.team_members tm ON tm.id = su.team_member_id
    WHERE tm.agency_id = NEW.agency_id
      AND su.is_active = true
  LOOP
    -- Create progress records for all staff-visible lessons
    FOR v_lesson IN
      SELECT sel.id, sem.week_number, sel.day_of_week
      FROM public.sales_experience_lessons sel
      JOIN public.sales_experience_modules sem ON sem.id = sel.module_id
      WHERE sel.is_staff_visible = true
      ORDER BY sem.week_number, sel.day_of_week
    LOOP
      INSERT INTO public.sales_experience_staff_progress (
        assignment_id,
        staff_user_id,
        lesson_id,
        status,
        unlocked_at
      )
      VALUES (
        NEW.id,
        v_staff.id,
        v_lesson.id,
        -- Week 1, Monday (day_of_week=1) is immediately available
        CASE
          WHEN v_lesson.week_number = 1 AND v_lesson.day_of_week = 1 THEN 'available'::public.sales_experience_progress_status
          ELSE 'locked'::public.sales_experience_progress_status
        END,
        CASE
          WHEN v_lesson.week_number = 1 AND v_lesson.day_of_week = 1 THEN now()
          ELSE NULL
        END
      )
      ON CONFLICT (assignment_id, staff_user_id, lesson_id) DO NOTHING;
    END LOOP;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_initialize_se_staff_progress ON public.sales_experience_assignments;
CREATE TRIGGER trigger_initialize_se_staff_progress
AFTER INSERT OR UPDATE ON public.sales_experience_assignments
FOR EACH ROW
EXECUTE FUNCTION public.initialize_sales_experience_staff_progress();

-- 4.3 Queue initial lesson emails when assignment becomes active
CREATE OR REPLACE FUNCTION public.queue_sales_experience_lesson_emails()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_staff record;
  v_owner record;
  v_lesson record;
  v_scheduled_date date;
  v_template record;
BEGIN
  -- Only run when status changes to 'active'
  IF NEW.status != 'active' OR (OLD IS NOT NULL AND OLD.status = 'active') THEN
    RETURN NEW;
  END IF;

  -- Get email template
  SELECT * INTO v_template
  FROM public.sales_experience_email_templates
  WHERE template_key = 'lesson_available' AND is_active = true;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Queue first week of emails for all staff
  FOR v_staff IN
    SELECT su.id as staff_user_id, tm.email, COALESCE(su.display_name, tm.name) as name
    FROM public.staff_users su
    JOIN public.team_members tm ON tm.id = su.team_member_id
    WHERE tm.agency_id = NEW.agency_id
      AND su.is_active = true
      AND tm.email IS NOT NULL
  LOOP
    FOR v_lesson IN
      SELECT sel.id, sel.title, sem.week_number, sel.day_of_week
      FROM public.sales_experience_lessons sel
      JOIN public.sales_experience_modules sem ON sem.id = sel.module_id
      WHERE sem.week_number = 1 AND sel.is_staff_visible = true
      ORDER BY sel.day_of_week
    LOOP
      -- Calculate scheduled date based on day_of_week
      -- start_date is Monday (day 1), so:
      -- Mon (1) = start_date + 0
      -- Wed (3) = start_date + 2
      -- Fri (5) = start_date + 4
      v_scheduled_date := NEW.start_date + (v_lesson.day_of_week - 1);

      INSERT INTO public.sales_experience_email_queue (
        assignment_id,
        template_key,
        recipient_email,
        recipient_name,
        recipient_type,
        scheduled_for,
        email_subject,
        email_body_html,
        variables_json,
        status
      )
      VALUES (
        NEW.id,
        'lesson_available',
        v_staff.email,
        v_staff.name,
        'staff',
        v_scheduled_date + TIME '07:00:00',
        REPLACE(v_template.subject_template, '{{lesson_title}}', v_lesson.title),
        v_template.body_template,
        jsonb_build_object(
          'lesson_title', v_lesson.title,
          'week_number', v_lesson.week_number,
          'staff_name', v_staff.name
        ),
        'pending'
      )
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_queue_se_lesson_emails ON public.sales_experience_assignments;
CREATE TRIGGER trigger_queue_se_lesson_emails
AFTER INSERT OR UPDATE ON public.sales_experience_assignments
FOR EACH ROW
EXECUTE FUNCTION public.queue_sales_experience_lesson_emails();

-- =====================================================
-- 5. ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.sales_experience_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_experience_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_experience_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_experience_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_experience_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_experience_ai_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_experience_owner_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_experience_staff_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_experience_quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_experience_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_experience_email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_experience_email_queue ENABLE ROW LEVEL SECURITY;

-- Assignments: Agency access + admin
DROP POLICY IF EXISTS "se_assignments_select" ON public.sales_experience_assignments;
CREATE POLICY "se_assignments_select" ON public.sales_experience_assignments
FOR SELECT USING (
  public.has_agency_access(auth.uid(), agency_id) OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "se_assignments_insert" ON public.sales_experience_assignments;
CREATE POLICY "se_assignments_insert" ON public.sales_experience_assignments
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "se_assignments_update" ON public.sales_experience_assignments;
CREATE POLICY "se_assignments_update" ON public.sales_experience_assignments
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "se_assignments_delete" ON public.sales_experience_assignments;
CREATE POLICY "se_assignments_delete" ON public.sales_experience_assignments
FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Modules: Public read (content is controlled at lesson level)
DROP POLICY IF EXISTS "se_modules_select" ON public.sales_experience_modules;
CREATE POLICY "se_modules_select" ON public.sales_experience_modules
FOR SELECT USING (true);

DROP POLICY IF EXISTS "se_modules_admin" ON public.sales_experience_modules;
CREATE POLICY "se_modules_admin" ON public.sales_experience_modules
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Lessons: Public read for structure, content access controlled by assignment
DROP POLICY IF EXISTS "se_lessons_select" ON public.sales_experience_lessons;
CREATE POLICY "se_lessons_select" ON public.sales_experience_lessons
FOR SELECT USING (true);

DROP POLICY IF EXISTS "se_lessons_admin" ON public.sales_experience_lessons;
CREATE POLICY "se_lessons_admin" ON public.sales_experience_lessons
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Resources: Agency access for those with assignments
DROP POLICY IF EXISTS "se_resources_select" ON public.sales_experience_resources;
CREATE POLICY "se_resources_select" ON public.sales_experience_resources
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.sales_experience_assignments sea
    WHERE sea.status IN ('active', 'completed')
      AND public.has_agency_access(auth.uid(), sea.agency_id)
  ) OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "se_resources_admin" ON public.sales_experience_resources;
CREATE POLICY "se_resources_admin" ON public.sales_experience_resources
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Transcripts: Agency access
DROP POLICY IF EXISTS "se_transcripts_select" ON public.sales_experience_transcripts;
CREATE POLICY "se_transcripts_select" ON public.sales_experience_transcripts
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.sales_experience_assignments sea
    WHERE sea.id = assignment_id
      AND public.has_agency_access(auth.uid(), sea.agency_id)
  ) OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "se_transcripts_insert" ON public.sales_experience_transcripts;
CREATE POLICY "se_transcripts_insert" ON public.sales_experience_transcripts
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "se_transcripts_update" ON public.sales_experience_transcripts;
CREATE POLICY "se_transcripts_update" ON public.sales_experience_transcripts
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- AI Prompts: Admin only
DROP POLICY IF EXISTS "se_ai_prompts_select" ON public.sales_experience_ai_prompts;
CREATE POLICY "se_ai_prompts_select" ON public.sales_experience_ai_prompts
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "se_ai_prompts_all" ON public.sales_experience_ai_prompts;
CREATE POLICY "se_ai_prompts_all" ON public.sales_experience_ai_prompts
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Owner Progress: Agency access
DROP POLICY IF EXISTS "se_owner_progress_select" ON public.sales_experience_owner_progress;
CREATE POLICY "se_owner_progress_select" ON public.sales_experience_owner_progress
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.sales_experience_assignments sea
    WHERE sea.id = assignment_id
      AND public.has_agency_access(auth.uid(), sea.agency_id)
  )
);

DROP POLICY IF EXISTS "se_owner_progress_insert" ON public.sales_experience_owner_progress;
CREATE POLICY "se_owner_progress_insert" ON public.sales_experience_owner_progress
FOR INSERT WITH CHECK (
  user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.sales_experience_assignments sea
    WHERE sea.id = assignment_id
      AND public.has_agency_access(auth.uid(), sea.agency_id)
  )
);

DROP POLICY IF EXISTS "se_owner_progress_update" ON public.sales_experience_owner_progress;
CREATE POLICY "se_owner_progress_update" ON public.sales_experience_owner_progress
FOR UPDATE USING (
  user_id = auth.uid()
);

-- Staff Progress: Service role (accessed via edge functions)
DROP POLICY IF EXISTS "se_staff_progress_service" ON public.sales_experience_staff_progress;
CREATE POLICY "se_staff_progress_service" ON public.sales_experience_staff_progress
FOR ALL USING (true) WITH CHECK (true);

-- Quiz Attempts: Service role (accessed via edge functions)
DROP POLICY IF EXISTS "se_quiz_attempts_service" ON public.sales_experience_quiz_attempts;
CREATE POLICY "se_quiz_attempts_service" ON public.sales_experience_quiz_attempts
FOR ALL USING (true) WITH CHECK (true);

-- Messages: Agency access
DROP POLICY IF EXISTS "se_messages_select" ON public.sales_experience_messages;
CREATE POLICY "se_messages_select" ON public.sales_experience_messages
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.sales_experience_assignments sea
    WHERE sea.id = assignment_id
      AND public.has_agency_access(auth.uid(), sea.agency_id)
  ) OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "se_messages_insert" ON public.sales_experience_messages;
CREATE POLICY "se_messages_insert" ON public.sales_experience_messages
FOR INSERT WITH CHECK (
  sender_user_id = auth.uid() AND
  (
    EXISTS (
      SELECT 1 FROM public.sales_experience_assignments sea
      WHERE sea.id = assignment_id
        AND public.has_agency_access(auth.uid(), sea.agency_id)
    ) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
);

DROP POLICY IF EXISTS "se_messages_update" ON public.sales_experience_messages;
CREATE POLICY "se_messages_update" ON public.sales_experience_messages
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.sales_experience_assignments sea
    WHERE sea.id = assignment_id
      AND public.has_agency_access(auth.uid(), sea.agency_id)
  ) OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Email Templates: Admin only
DROP POLICY IF EXISTS "se_email_templates_select" ON public.sales_experience_email_templates;
CREATE POLICY "se_email_templates_select" ON public.sales_experience_email_templates
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "se_email_templates_all" ON public.sales_experience_email_templates;
CREATE POLICY "se_email_templates_all" ON public.sales_experience_email_templates
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Email Queue: Service role
DROP POLICY IF EXISTS "se_email_queue_service" ON public.sales_experience_email_queue;
CREATE POLICY "se_email_queue_service" ON public.sales_experience_email_queue
FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- 6. SEED DATA
-- =====================================================

-- 6.1 Insert the 8 weekly modules
INSERT INTO public.sales_experience_modules (week_number, title, description, pillar, icon, sort_order)
VALUES
  (1, 'Sales Process Foundation', 'Establish the core principles of a structured sales approach', 'sales_process', 'foundation', 1),
  (2, 'Prospecting & Pipeline', 'Build a consistent prospecting engine and healthy pipeline', 'sales_process', 'search', 2),
  (3, 'Discovery & Qualification', 'Master the art of understanding customer needs and qualifying opportunities', 'sales_process', 'target', 3),
  (4, 'Building Accountability Systems', 'Create structures that drive consistent performance', 'accountability', 'check-square', 4),
  (5, 'Metrics & Performance Tracking', 'Implement KPIs and dashboards that drive behavior', 'accountability', 'bar-chart', 5),
  (6, 'Coaching Fundamentals', 'Learn the principles of effective sales coaching', 'coaching_cadence', 'users', 6),
  (7, 'One-on-One Excellence', 'Master the weekly coaching conversation', 'coaching_cadence', 'message-circle', 7),
  (8, 'Sustaining the System', 'Lock in habits and create long-term success', 'coaching_cadence', 'lock', 8)
ON CONFLICT (week_number) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  pillar = EXCLUDED.pillar,
  icon = EXCLUDED.icon,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

-- 6.2 Insert placeholder lessons (3 per week, Mon/Wed/Fri)
DO $$
DECLARE
  v_module_id uuid;
  v_week integer;
  v_day_of_week integer;
  v_title text;
  v_week_titles text[] := ARRAY[
    'Sales Process Foundation',
    'Prospecting & Pipeline',
    'Discovery & Qualification',
    'Building Accountability Systems',
    'Metrics & Performance Tracking',
    'Coaching Fundamentals',
    'One-on-One Excellence',
    'Sustaining the System'
  ];
  v_day_names text[] := ARRAY['Monday', 'Wednesday', 'Friday'];
  v_day_values integer[] := ARRAY[1, 3, 5];
  v_lesson_index integer;
BEGIN
  FOR v_week IN 1..8 LOOP
    -- Get module id for this week
    SELECT id INTO v_module_id
    FROM public.sales_experience_modules
    WHERE week_number = v_week;

    FOR v_lesson_index IN 1..3 LOOP
      v_day_of_week := v_day_values[v_lesson_index];
      v_title := 'Week ' || v_week || ' ' || v_day_names[v_lesson_index] || ': ' || v_week_titles[v_week];

      INSERT INTO public.sales_experience_lessons (
        module_id,
        day_of_week,
        title,
        description,
        is_staff_visible,
        sort_order
      )
      VALUES (
        v_module_id,
        v_day_of_week,
        v_title,
        'Lesson content for ' || v_day_names[v_lesson_index] || ' of Week ' || v_week,
        true,
        v_lesson_index
      )
      ON CONFLICT (module_id, day_of_week) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        sort_order = EXCLUDED.sort_order,
        updated_at = now();
    END LOOP;
  END LOOP;
END $$;

-- 6.3 Insert AI prompts
INSERT INTO public.sales_experience_ai_prompts (prompt_key, prompt_name, prompt_template, model_preference, description)
VALUES
  ('transcript_summary', 'Transcript Summarization',
   'You are an expert sales coach assistant. Summarize the following coaching call transcript, highlighting:
1. Key discussion points
2. Challenges identified
3. Action items agreed upon
4. Wins and successes mentioned

Transcript:
{{transcript}}

Provide a concise summary in bullet points.',
   'claude-3-haiku',
   'Used when uploading Zoom transcripts to generate AI summaries'),

  ('quiz_feedback', 'Quiz Feedback Generation',
   'You are a supportive sales coach providing feedback on a quiz response. The question was:
{{question}}

The correct answer is:
{{correct_answer}}

The staff member answered:
{{user_answer}}

Their score: {{score}}%

Provide brief, encouraging feedback that:
1. Acknowledges what they got right
2. Gently corrects any misunderstandings
3. Offers a practical tip for applying this concept

Keep the tone warm and coaching-oriented.',
   'claude-3-haiku',
   'Used to generate personalized feedback on quiz responses'),

  ('action_items_extraction', 'Action Items Extraction',
   'Extract all action items from this coaching call transcript. For each action item, identify:
- The specific action
- Who is responsible
- Any mentioned deadline or timeframe

Transcript:
{{transcript}}

Return as a JSON array of objects with fields: action, owner, deadline (or null if not specified).',
   'claude-3-haiku',
   'Used to extract action items from transcripts as structured data')
ON CONFLICT (prompt_key) DO UPDATE SET
  prompt_name = EXCLUDED.prompt_name,
  prompt_template = EXCLUDED.prompt_template,
  model_preference = EXCLUDED.model_preference,
  description = EXCLUDED.description,
  updated_at = now();

-- 6.4 Insert email templates
INSERT INTO public.sales_experience_email_templates (template_key, template_name, subject_template, body_template, variables_available, is_active)
VALUES
  ('lesson_available', 'New Lesson Available',
   'New Sales Training Lesson: {{lesson_title}}',
   '<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2>Hi {{staff_name}},</h2>
  <p>A new lesson is available in your 8-Week Sales Experience training!</p>
  <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
    <h3 style="margin-top: 0;">{{lesson_title}}</h3>
    <p>Week {{week_number}} - {{day_name}}</p>
  </div>
  <p><a href="{{lesson_url}}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Start Lesson</a></p>
  <p>Keep up the great work!</p>
</body>
</html>',
   '["staff_name", "lesson_title", "week_number", "day_name", "lesson_url"]'::jsonb,
   true),

  ('quiz_completed', 'Quiz Completed Notification',
   '{{staff_name}} completed Week {{week_number}} Quiz - {{score}}%',
   '<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2>Quiz Completion Update</h2>
  <p><strong>{{staff_name}}</strong> has completed the quiz for:</p>
  <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
    <h3 style="margin-top: 0;">{{lesson_title}}</h3>
    <p>Week {{week_number}}</p>
    <p style="font-size: 24px; font-weight: bold; color: {{score_color}};">Score: {{score}}%</p>
  </div>
  {{#if feedback_ai}}
  <div style="border-left: 4px solid #2563eb; padding-left: 16px; margin: 20px 0;">
    <h4>AI Feedback Summary:</h4>
    <p>{{feedback_ai}}</p>
  </div>
  {{/if}}
  <p><a href="{{team_progress_url}}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Team Progress</a></p>
</body>
</html>',
   '["staff_name", "lesson_title", "week_number", "score", "score_color", "feedback_ai", "team_progress_url"]'::jsonb,
   true),

  ('weekly_summary', 'Weekly Progress Summary',
   '8-Week Experience: Week {{week_number}} Summary',
   '<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2>Week {{week_number}} Summary</h2>
  <p>Here''s how your team performed this week in the 8-Week Sales Experience:</p>

  <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
    <h3 style="margin-top: 0;">Team Completion</h3>
    <p style="font-size: 36px; font-weight: bold; color: #16a34a;">{{completion_rate}}%</p>
    <p>{{completed_count}} of {{total_staff}} team members completed all lessons</p>
  </div>

  <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
    <h3 style="margin-top: 0;">Quiz Performance</h3>
    <p style="font-size: 36px; font-weight: bold;">{{avg_quiz_score}}%</p>
    <p>Average quiz score</p>
  </div>

  {{#if upcoming_week}}
  <div style="border-left: 4px solid #2563eb; padding-left: 16px; margin: 20px 0;">
    <h4>Coming Up: Week {{next_week_number}}</h4>
    <p>{{next_week_title}}</p>
  </div>
  {{/if}}

  <p><a href="{{dashboard_url}}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Full Dashboard</a></p>
</body>
</html>',
   '["week_number", "completion_rate", "completed_count", "total_staff", "avg_quiz_score", "next_week_number", "next_week_title", "dashboard_url"]'::jsonb,
   true),

  ('coach_message', 'New Message from Coach',
   'New message from your coach',
   '<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2>New Message from Your Coach</h2>
  <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
    <p>{{message_preview}}</p>
  </div>
  <p><a href="{{messages_url}}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Message</a></p>
</body>
</html>',
   '["message_preview", "messages_url"]'::jsonb,
   true)
ON CONFLICT (template_key) DO UPDATE SET
  template_name = EXCLUDED.template_name,
  subject_template = EXCLUDED.subject_template,
  body_template = EXCLUDED.body_template,
  variables_available = EXCLUDED.variables_available,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- =====================================================
-- 7. COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE public.sales_experience_assignments IS '8-Week Sales Experience program assignments per agency';
COMMENT ON TABLE public.sales_experience_modules IS 'The 8 weekly modules mapping to 3 pillars';
COMMENT ON TABLE public.sales_experience_lessons IS 'Individual lessons (3 per week, Mon/Wed/Fri = 24 total)';
COMMENT ON TABLE public.sales_experience_resources IS 'Downloadable documents and resources per module';
COMMENT ON TABLE public.sales_experience_transcripts IS 'Zoom meeting transcripts with AI summaries';
COMMENT ON TABLE public.sales_experience_ai_prompts IS 'Admin-editable AI prompts for various features';
COMMENT ON TABLE public.sales_experience_owner_progress IS 'Owner/Manager lesson completion tracking';
COMMENT ON TABLE public.sales_experience_staff_progress IS 'Staff lesson completion with time-gating';
COMMENT ON TABLE public.sales_experience_quiz_attempts IS 'Staff quiz attempt history';
COMMENT ON TABLE public.sales_experience_messages IS 'Coach to Agency owner/manager messaging';
COMMENT ON TABLE public.sales_experience_email_templates IS 'Editable email templates for notifications';
COMMENT ON TABLE public.sales_experience_email_queue IS 'Scheduled email queue for lesson reminders';

COMMENT ON FUNCTION public.get_sales_experience_business_day IS 'Calculate business days (M-F) between two dates';
COMMENT ON FUNCTION public.is_sales_experience_lesson_unlocked IS 'Check if a lesson is unlocked based on time-gating (Mon/Wed/Fri)';
COMMENT ON FUNCTION public.get_sales_experience_current_week IS 'Get current week number for an assignment';
COMMENT ON FUNCTION public.has_sales_experience_access IS 'Check if user has access to Sales Experience features';
