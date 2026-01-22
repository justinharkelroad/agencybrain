-- =====================================================
-- The Challenge - Six-Week Staff Development Program
-- Migration: Tables, Functions, Triggers, and Seed Data
-- =====================================================

-- =====================================================
-- 1. ENUMS
-- =====================================================

-- Challenge purchase status
DO $$ BEGIN
  CREATE TYPE public.challenge_purchase_status AS ENUM ('pending', 'completed', 'failed', 'refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Challenge assignment status
DO $$ BEGIN
  CREATE TYPE public.challenge_assignment_status AS ENUM ('pending', 'active', 'paused', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Challenge progress status
DO $$ BEGIN
  CREATE TYPE public.challenge_progress_status AS ENUM ('locked', 'available', 'in_progress', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Challenge email status
DO $$ BEGIN
  CREATE TYPE public.challenge_email_status AS ENUM ('pending', 'sent', 'failed', 'skipped');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =====================================================
-- 2. TABLES
-- =====================================================

-- 2.1 Challenge Products - The purchasable program
CREATE TABLE IF NOT EXISTS public.challenge_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  -- Tiered pricing (in cents)
  price_one_on_one_cents integer NOT NULL DEFAULT 5000,  -- $50
  price_boardroom_cents integer NOT NULL DEFAULT 9900,   -- $99
  price_standalone_cents integer NOT NULL DEFAULT 29900, -- $299
  -- Program details
  total_lessons integer NOT NULL DEFAULT 30,
  duration_weeks integer NOT NULL DEFAULT 6,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_challenge_products_slug ON public.challenge_products(slug);
CREATE INDEX IF NOT EXISTS idx_challenge_products_active ON public.challenge_products(is_active);

-- 2.2 Challenge Modules - Week 1-6 groupings
CREATE TABLE IF NOT EXISTS public.challenge_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_product_id uuid NOT NULL REFERENCES public.challenge_products(id) ON DELETE CASCADE,
  name text NOT NULL,
  week_number integer NOT NULL CHECK (week_number >= 1 AND week_number <= 6),
  description text,
  icon text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(challenge_product_id, week_number)
);

CREATE INDEX IF NOT EXISTS idx_challenge_modules_product ON public.challenge_modules(challenge_product_id);
CREATE INDEX IF NOT EXISTS idx_challenge_modules_week ON public.challenge_modules(challenge_product_id, week_number);

-- 2.3 Challenge Lessons - 30 daily lessons (5 per week, M-F)
CREATE TABLE IF NOT EXISTS public.challenge_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES public.challenge_modules(id) ON DELETE CASCADE,
  challenge_product_id uuid NOT NULL REFERENCES public.challenge_products(id) ON DELETE CASCADE,
  title text NOT NULL,
  day_number integer NOT NULL CHECK (day_number >= 1 AND day_number <= 30),
  -- Generated columns for week/day-of-week
  week_number integer GENERATED ALWAYS AS (((day_number - 1) / 5) + 1) STORED,
  day_of_week integer GENERATED ALWAYS AS (((day_number - 1) % 5) + 1) STORED, -- 1=Mon, 5=Fri
  -- Content
  video_url text,
  video_thumbnail_url text,
  preview_text text,
  content_html text,
  -- JSONB for flexible structures
  questions jsonb DEFAULT '[]'::jsonb,
  action_items jsonb DEFAULT '[]'::jsonb,
  -- Special flags
  is_discovery_stack boolean NOT NULL DEFAULT false, -- Friday lessons
  -- Email content
  email_subject text,
  email_preview text,
  -- Metadata
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(challenge_product_id, day_number)
);

CREATE INDEX IF NOT EXISTS idx_challenge_lessons_module ON public.challenge_lessons(module_id);
CREATE INDEX IF NOT EXISTS idx_challenge_lessons_product ON public.challenge_lessons(challenge_product_id);
CREATE INDEX IF NOT EXISTS idx_challenge_lessons_day ON public.challenge_lessons(challenge_product_id, day_number);

-- 2.4 Challenge Purchases - Agency seat purchases
CREATE TABLE IF NOT EXISTS public.challenge_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  challenge_product_id uuid NOT NULL REFERENCES public.challenge_products(id) ON DELETE RESTRICT,
  purchaser_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  -- Seat tracking
  quantity integer NOT NULL CHECK (quantity >= 1),
  seats_used integer NOT NULL DEFAULT 0 CHECK (seats_used >= 0),
  -- Pricing snapshot at time of purchase
  price_per_seat_cents integer NOT NULL,
  total_price_cents integer NOT NULL,
  membership_tier text, -- Snapshot of tier at purchase time
  -- Stripe integration
  stripe_payment_intent_id text,
  stripe_checkout_session_id text,
  -- Status
  status public.challenge_purchase_status NOT NULL DEFAULT 'pending',
  purchased_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Constraint: seats_used cannot exceed quantity
  CONSTRAINT seats_used_within_quantity CHECK (seats_used <= quantity)
);

CREATE INDEX IF NOT EXISTS idx_challenge_purchases_agency ON public.challenge_purchases(agency_id);
CREATE INDEX IF NOT EXISTS idx_challenge_purchases_status ON public.challenge_purchases(agency_id, status);
CREATE INDEX IF NOT EXISTS idx_challenge_purchases_stripe ON public.challenge_purchases(stripe_checkout_session_id);

-- 2.5 Challenge Assignments - Staff assigned to challenge
CREATE TABLE IF NOT EXISTS public.challenge_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES public.challenge_purchases(id) ON DELETE CASCADE,
  challenge_product_id uuid NOT NULL REFERENCES public.challenge_products(id) ON DELETE RESTRICT,
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  -- Staff linkage (one or the other must be set)
  staff_user_id uuid REFERENCES public.staff_users(id) ON DELETE CASCADE,
  team_member_id uuid REFERENCES public.team_members(id) ON DELETE SET NULL,
  -- Assignment details
  assigned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  start_date date NOT NULL,
  end_date date GENERATED ALWAYS AS (start_date + INTERVAL '41 days') STORED, -- 6 weeks from start
  timezone text NOT NULL DEFAULT 'America/New_York',
  -- Status
  status public.challenge_assignment_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Constraints
  CONSTRAINT staff_or_team_member CHECK (staff_user_id IS NOT NULL OR team_member_id IS NOT NULL),
  UNIQUE(purchase_id, staff_user_id)
);

CREATE INDEX IF NOT EXISTS idx_challenge_assignments_purchase ON public.challenge_assignments(purchase_id);
CREATE INDEX IF NOT EXISTS idx_challenge_assignments_staff ON public.challenge_assignments(staff_user_id);
CREATE INDEX IF NOT EXISTS idx_challenge_assignments_agency ON public.challenge_assignments(agency_id);
CREATE INDEX IF NOT EXISTS idx_challenge_assignments_status ON public.challenge_assignments(status);

-- 2.6 Challenge Progress - Lesson completion tracking
CREATE TABLE IF NOT EXISTS public.challenge_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.challenge_assignments(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.challenge_lessons(id) ON DELETE CASCADE,
  staff_user_id uuid REFERENCES public.staff_users(id) ON DELETE CASCADE,
  -- Status
  status public.challenge_progress_status NOT NULL DEFAULT 'locked',
  -- Timestamps
  unlocked_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  -- Video tracking
  video_watched_seconds integer DEFAULT 0,
  video_completed boolean DEFAULT false,
  -- Reflection responses (JSONB for flexibility)
  reflection_response jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(assignment_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS idx_challenge_progress_assignment ON public.challenge_progress(assignment_id);
CREATE INDEX IF NOT EXISTS idx_challenge_progress_lesson ON public.challenge_progress(lesson_id);
CREATE INDEX IF NOT EXISTS idx_challenge_progress_staff ON public.challenge_progress(staff_user_id);
CREATE INDEX IF NOT EXISTS idx_challenge_progress_status ON public.challenge_progress(assignment_id, status);

-- 2.7 Challenge Core 4 Logs - Body, Being, Balance, Business daily tracking
CREATE TABLE IF NOT EXISTS public.challenge_core4_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.challenge_assignments(id) ON DELETE CASCADE,
  staff_user_id uuid REFERENCES public.staff_users(id) ON DELETE CASCADE,
  log_date date NOT NULL,
  -- Core 4 checkboxes
  body boolean NOT NULL DEFAULT false,
  being boolean NOT NULL DEFAULT false,
  balance boolean NOT NULL DEFAULT false,
  business boolean NOT NULL DEFAULT false,
  -- Optional notes
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(assignment_id, log_date)
);

CREATE INDEX IF NOT EXISTS idx_challenge_core4_assignment ON public.challenge_core4_logs(assignment_id);
CREATE INDEX IF NOT EXISTS idx_challenge_core4_date ON public.challenge_core4_logs(assignment_id, log_date);
CREATE INDEX IF NOT EXISTS idx_challenge_core4_staff ON public.challenge_core4_logs(staff_user_id);

-- 2.8 Challenge Email Queue - Daily email scheduling
CREATE TABLE IF NOT EXISTS public.challenge_email_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.challenge_assignments(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.challenge_lessons(id) ON DELETE CASCADE,
  staff_user_id uuid REFERENCES public.staff_users(id) ON DELETE CASCADE,
  -- Recipient info
  recipient_email text NOT NULL,
  recipient_name text,
  email_subject text NOT NULL,
  -- Scheduling
  scheduled_for timestamptz NOT NULL,
  -- Status
  status public.challenge_email_status NOT NULL DEFAULT 'pending',
  sent_at timestamptz,
  -- Error handling
  resend_message_id text,
  error_message text,
  retry_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_challenge_email_assignment ON public.challenge_email_queue(assignment_id);
CREATE INDEX IF NOT EXISTS idx_challenge_email_status ON public.challenge_email_queue(status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_challenge_email_scheduled ON public.challenge_email_queue(scheduled_for) WHERE status = 'pending';

-- =====================================================
-- 3. HELPER FUNCTIONS
-- =====================================================

-- 3.1 Get business day number (excludes weekends)
CREATE OR REPLACE FUNCTION public.get_challenge_business_day(
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

-- 3.2 Check if a lesson is unlocked for an assignment
CREATE OR REPLACE FUNCTION public.is_challenge_lesson_unlocked(
  p_assignment_id uuid,
  p_day_number integer
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_assignment record;
  v_business_day integer;
BEGIN
  -- Get assignment details
  SELECT start_date, status INTO v_assignment
  FROM public.challenge_assignments
  WHERE id = p_assignment_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Assignment must be active
  IF v_assignment.status != 'active' THEN
    RETURN false;
  END IF;

  -- Calculate current business day
  v_business_day := public.get_challenge_business_day(v_assignment.start_date, CURRENT_DATE);

  -- Lesson is unlocked if we're on or past that day
  RETURN v_business_day >= p_day_number;
END;
$$;

-- 3.3 Get next Monday from a given date
CREATE OR REPLACE FUNCTION public.get_next_monday(p_from_date date DEFAULT CURRENT_DATE)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_day_of_week integer;
  v_days_until_monday integer;
BEGIN
  -- Get ISO day of week (1=Mon, 7=Sun)
  v_day_of_week := EXTRACT(ISODOW FROM p_from_date);

  -- If today is Monday, return next Monday
  IF v_day_of_week = 1 THEN
    v_days_until_monday := 7;
  ELSE
    v_days_until_monday := 8 - v_day_of_week;
  END IF;

  RETURN p_from_date + v_days_until_monday;
END;
$$;

-- 3.4 Get challenge price based on membership tier
CREATE OR REPLACE FUNCTION public.get_challenge_price_cents(
  p_product_id uuid,
  p_membership_tier text
)
RETURNS integer
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_product record;
BEGIN
  SELECT price_one_on_one_cents, price_boardroom_cents, price_standalone_cents
  INTO v_product
  FROM public.challenge_products
  WHERE id = p_product_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  CASE p_membership_tier
    WHEN '1:1 Coaching' THEN RETURN v_product.price_one_on_one_cents;
    WHEN 'Boardroom' THEN RETURN v_product.price_boardroom_cents;
    ELSE RETURN v_product.price_standalone_cents;
  END CASE;
END;
$$;

-- =====================================================
-- 4. TRIGGERS
-- =====================================================

-- 4.1 Update purchase seats_used on assignment create/delete
CREATE OR REPLACE FUNCTION public.update_challenge_purchase_seats_used()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.challenge_purchases
    SET seats_used = seats_used + 1,
        updated_at = now()
    WHERE id = NEW.purchase_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.challenge_purchases
    SET seats_used = GREATEST(0, seats_used - 1),
        updated_at = now()
    WHERE id = OLD.purchase_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_challenge_purchase_seats ON public.challenge_assignments;
CREATE TRIGGER trigger_update_challenge_purchase_seats
AFTER INSERT OR DELETE ON public.challenge_assignments
FOR EACH ROW
EXECUTE FUNCTION public.update_challenge_purchase_seats_used();

-- 4.2 Initialize challenge progress when assignment created
CREATE OR REPLACE FUNCTION public.initialize_challenge_progress()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lesson record;
BEGIN
  -- Create progress records for all lessons in the product
  FOR v_lesson IN
    SELECT id, day_number
    FROM public.challenge_lessons
    WHERE challenge_product_id = NEW.challenge_product_id
    ORDER BY day_number
  LOOP
    INSERT INTO public.challenge_progress (
      assignment_id,
      lesson_id,
      staff_user_id,
      status,
      unlocked_at
    )
    VALUES (
      NEW.id,
      v_lesson.id,
      NEW.staff_user_id,
      CASE
        WHEN v_lesson.day_number = 1 THEN 'available'::public.challenge_progress_status
        ELSE 'locked'::public.challenge_progress_status
      END,
      CASE
        WHEN v_lesson.day_number = 1 THEN now()
        ELSE NULL
      END
    )
    ON CONFLICT (assignment_id, lesson_id) DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_initialize_challenge_progress ON public.challenge_assignments;
CREATE TRIGGER trigger_initialize_challenge_progress
AFTER INSERT ON public.challenge_assignments
FOR EACH ROW
EXECUTE FUNCTION public.initialize_challenge_progress();

-- 4.3 Queue initial challenge emails when assignment created
CREATE OR REPLACE FUNCTION public.queue_initial_challenge_emails()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_staff record;
  v_lesson record;
  v_email text;
  v_name text;
  v_scheduled_date date;
BEGIN
  -- Get staff user info
  SELECT su.id, tm.email, COALESCE(su.display_name, tm.name) as name
  INTO v_staff
  FROM public.staff_users su
  LEFT JOIN public.team_members tm ON tm.id = su.team_member_id
  WHERE su.id = NEW.staff_user_id;

  IF v_staff IS NULL OR v_staff.email IS NULL THEN
    -- No email to send
    RETURN NEW;
  END IF;

  v_email := v_staff.email;
  v_name := v_staff.name;

  -- Queue first week of emails (days 1-5)
  FOR v_lesson IN
    SELECT cl.id, cl.day_number, cl.email_subject, cl.title
    FROM public.challenge_lessons cl
    WHERE cl.challenge_product_id = NEW.challenge_product_id
      AND cl.day_number <= 5
    ORDER BY cl.day_number
  LOOP
    -- Calculate scheduled date: start_date + (day_number - 1) business days
    v_scheduled_date := NEW.start_date + (v_lesson.day_number - 1);

    -- Skip weekends by adding days
    WHILE EXTRACT(ISODOW FROM v_scheduled_date) > 5 LOOP
      v_scheduled_date := v_scheduled_date + 1;
    END LOOP;

    INSERT INTO public.challenge_email_queue (
      assignment_id,
      lesson_id,
      staff_user_id,
      recipient_email,
      recipient_name,
      email_subject,
      scheduled_for,
      status
    )
    VALUES (
      NEW.id,
      v_lesson.id,
      NEW.staff_user_id,
      v_email,
      v_name,
      COALESCE(v_lesson.email_subject, 'Day ' || v_lesson.day_number || ': ' || v_lesson.title),
      v_scheduled_date + TIME '07:00:00', -- 7 AM
      'pending'
    )
    ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_queue_initial_challenge_emails ON public.challenge_assignments;
CREATE TRIGGER trigger_queue_initial_challenge_emails
AFTER INSERT ON public.challenge_assignments
FOR EACH ROW
EXECUTE FUNCTION public.queue_initial_challenge_emails();

-- 4.4 Updated_at trigger for all challenge tables
CREATE OR REPLACE FUNCTION public.update_challenge_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Apply updated_at triggers to all challenge tables
DROP TRIGGER IF EXISTS update_challenge_products_updated_at ON public.challenge_products;
CREATE TRIGGER update_challenge_products_updated_at
BEFORE UPDATE ON public.challenge_products
FOR EACH ROW EXECUTE FUNCTION public.update_challenge_updated_at();

DROP TRIGGER IF EXISTS update_challenge_modules_updated_at ON public.challenge_modules;
CREATE TRIGGER update_challenge_modules_updated_at
BEFORE UPDATE ON public.challenge_modules
FOR EACH ROW EXECUTE FUNCTION public.update_challenge_updated_at();

DROP TRIGGER IF EXISTS update_challenge_lessons_updated_at ON public.challenge_lessons;
CREATE TRIGGER update_challenge_lessons_updated_at
BEFORE UPDATE ON public.challenge_lessons
FOR EACH ROW EXECUTE FUNCTION public.update_challenge_updated_at();

DROP TRIGGER IF EXISTS update_challenge_purchases_updated_at ON public.challenge_purchases;
CREATE TRIGGER update_challenge_purchases_updated_at
BEFORE UPDATE ON public.challenge_purchases
FOR EACH ROW EXECUTE FUNCTION public.update_challenge_updated_at();

DROP TRIGGER IF EXISTS update_challenge_assignments_updated_at ON public.challenge_assignments;
CREATE TRIGGER update_challenge_assignments_updated_at
BEFORE UPDATE ON public.challenge_assignments
FOR EACH ROW EXECUTE FUNCTION public.update_challenge_updated_at();

DROP TRIGGER IF EXISTS update_challenge_progress_updated_at ON public.challenge_progress;
CREATE TRIGGER update_challenge_progress_updated_at
BEFORE UPDATE ON public.challenge_progress
FOR EACH ROW EXECUTE FUNCTION public.update_challenge_updated_at();

DROP TRIGGER IF EXISTS update_challenge_core4_updated_at ON public.challenge_core4_logs;
CREATE TRIGGER update_challenge_core4_updated_at
BEFORE UPDATE ON public.challenge_core4_logs
FOR EACH ROW EXECUTE FUNCTION public.update_challenge_updated_at();

DROP TRIGGER IF EXISTS update_challenge_email_updated_at ON public.challenge_email_queue;
CREATE TRIGGER update_challenge_email_updated_at
BEFORE UPDATE ON public.challenge_email_queue
FOR EACH ROW EXECUTE FUNCTION public.update_challenge_updated_at();

-- =====================================================
-- 5. ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.challenge_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_core4_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_email_queue ENABLE ROW LEVEL SECURITY;

-- Challenge Products: Public read for active products
DROP POLICY IF EXISTS "challenge_products_select" ON public.challenge_products;
CREATE POLICY "challenge_products_select" ON public.challenge_products
FOR SELECT USING (is_active = true);

-- Challenge Modules: Public read
DROP POLICY IF EXISTS "challenge_modules_select" ON public.challenge_modules;
CREATE POLICY "challenge_modules_select" ON public.challenge_modules
FOR SELECT USING (true);

-- Challenge Lessons: Public read
DROP POLICY IF EXISTS "challenge_lessons_select" ON public.challenge_lessons;
CREATE POLICY "challenge_lessons_select" ON public.challenge_lessons
FOR SELECT USING (true);

-- Challenge Purchases: Agency access
DROP POLICY IF EXISTS "challenge_purchases_select" ON public.challenge_purchases;
CREATE POLICY "challenge_purchases_select" ON public.challenge_purchases
FOR SELECT USING (public.has_agency_access(auth.uid(), agency_id));

DROP POLICY IF EXISTS "challenge_purchases_insert" ON public.challenge_purchases;
CREATE POLICY "challenge_purchases_insert" ON public.challenge_purchases
FOR INSERT WITH CHECK (public.has_agency_access(auth.uid(), agency_id));

DROP POLICY IF EXISTS "challenge_purchases_update" ON public.challenge_purchases;
CREATE POLICY "challenge_purchases_update" ON public.challenge_purchases
FOR UPDATE USING (public.has_agency_access(auth.uid(), agency_id));

-- Challenge Assignments: Agency access
DROP POLICY IF EXISTS "challenge_assignments_select" ON public.challenge_assignments;
CREATE POLICY "challenge_assignments_select" ON public.challenge_assignments
FOR SELECT USING (public.has_agency_access(auth.uid(), agency_id));

DROP POLICY IF EXISTS "challenge_assignments_insert" ON public.challenge_assignments;
CREATE POLICY "challenge_assignments_insert" ON public.challenge_assignments
FOR INSERT WITH CHECK (public.has_agency_access(auth.uid(), agency_id));

DROP POLICY IF EXISTS "challenge_assignments_update" ON public.challenge_assignments;
CREATE POLICY "challenge_assignments_update" ON public.challenge_assignments
FOR UPDATE USING (public.has_agency_access(auth.uid(), agency_id));

DROP POLICY IF EXISTS "challenge_assignments_delete" ON public.challenge_assignments;
CREATE POLICY "challenge_assignments_delete" ON public.challenge_assignments
FOR DELETE USING (public.has_agency_access(auth.uid(), agency_id));

-- Challenge Progress: Service role only (accessed via edge functions)
DROP POLICY IF EXISTS "challenge_progress_service" ON public.challenge_progress;
CREATE POLICY "challenge_progress_service" ON public.challenge_progress
FOR ALL USING (true) WITH CHECK (true);

-- Challenge Core4 Logs: Service role only (accessed via edge functions)
DROP POLICY IF EXISTS "challenge_core4_service" ON public.challenge_core4_logs;
CREATE POLICY "challenge_core4_service" ON public.challenge_core4_logs
FOR ALL USING (true) WITH CHECK (true);

-- Challenge Email Queue: Service role only (accessed via edge functions)
DROP POLICY IF EXISTS "challenge_email_service" ON public.challenge_email_queue;
CREATE POLICY "challenge_email_service" ON public.challenge_email_queue
FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- 6. SEED DATA
-- =====================================================

-- Insert the challenge product
INSERT INTO public.challenge_products (
  id,
  name,
  slug,
  description,
  price_one_on_one_cents,
  price_boardroom_cents,
  price_standalone_cents,
  total_lessons,
  duration_weeks,
  is_active
)
VALUES (
  'a0000000-0000-0000-0000-000000000001'::uuid,
  'The Standard Six-Week Challenge',
  'six-week-challenge',
  'A transformative 6-week staff development program designed to build exceptional habits, drive personal growth, and elevate professional performance. Each day delivers focused video content, reflection questions, and actionable items.',
  5000,   -- $50 for 1:1 Coaching members
  9900,   -- $99 for Boardroom members
  29900,  -- $299 for standalone
  30,
  6,
  true
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_one_on_one_cents = EXCLUDED.price_one_on_one_cents,
  price_boardroom_cents = EXCLUDED.price_boardroom_cents,
  price_standalone_cents = EXCLUDED.price_standalone_cents,
  updated_at = now();

-- Insert the 6 weekly modules
INSERT INTO public.challenge_modules (challenge_product_id, name, week_number, description, icon, sort_order)
VALUES
  ('a0000000-0000-0000-0000-000000000001'::uuid, 'Foundation', 1, 'Build your foundation with core habits and mindset shifts', 'foundation', 1),
  ('a0000000-0000-0000-0000-000000000001'::uuid, 'Consistency', 2, 'Develop the discipline of daily consistent action', 'repeat', 2),
  ('a0000000-0000-0000-0000-000000000001'::uuid, 'Discipline', 3, 'Master self-discipline and overcome resistance', 'shield', 3),
  ('a0000000-0000-0000-0000-000000000001'::uuid, 'Relationships', 4, 'Strengthen professional and personal relationships', 'users', 4),
  ('a0000000-0000-0000-0000-000000000001'::uuid, 'Closing', 5, 'Sharpen your ability to close and deliver results', 'target', 5),
  ('a0000000-0000-0000-0000-000000000001'::uuid, 'Identity', 6, 'Cement your new identity and sustain your transformation', 'crown', 6)
ON CONFLICT (challenge_product_id, week_number) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

-- Insert 30 placeholder lessons (5 per week)
DO $$
DECLARE
  v_module_id uuid;
  v_week integer;
  v_day_of_week integer;
  v_day_number integer;
  v_is_friday boolean;
  v_title text;
  v_week_names text[] := ARRAY['Foundation', 'Consistency', 'Discipline', 'Relationships', 'Closing', 'Identity'];
  v_day_names text[] := ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
BEGIN
  FOR v_week IN 1..6 LOOP
    -- Get module id for this week
    SELECT id INTO v_module_id
    FROM public.challenge_modules
    WHERE challenge_product_id = 'a0000000-0000-0000-0000-000000000001'::uuid
      AND week_number = v_week;

    FOR v_day_of_week IN 1..5 LOOP
      v_day_number := ((v_week - 1) * 5) + v_day_of_week;
      v_is_friday := v_day_of_week = 5;
      v_title := 'Week ' || v_week || ' ' || v_day_names[v_day_of_week] || ': ' || v_week_names[v_week];

      INSERT INTO public.challenge_lessons (
        module_id,
        challenge_product_id,
        title,
        day_number,
        is_discovery_stack,
        email_subject,
        email_preview,
        preview_text,
        sort_order
      )
      VALUES (
        v_module_id,
        'a0000000-0000-0000-0000-000000000001'::uuid,
        v_title,
        v_day_number,
        v_is_friday,
        'Day ' || v_day_number || ': ' || v_title,
        'Your daily challenge awaits. Let''s build something great today.',
        'Today''s focus: ' || v_week_names[v_week],
        v_day_number
      )
      ON CONFLICT (challenge_product_id, day_number) DO UPDATE SET
        module_id = EXCLUDED.module_id,
        title = EXCLUDED.title,
        is_discovery_stack = EXCLUDED.is_discovery_stack,
        email_subject = EXCLUDED.email_subject,
        email_preview = EXCLUDED.email_preview,
        preview_text = EXCLUDED.preview_text,
        sort_order = EXCLUDED.sort_order,
        updated_at = now();
    END LOOP;
  END LOOP;
END $$;

-- =====================================================
-- 7. COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE public.challenge_products IS 'The Challenge purchasable programs with tiered pricing';
COMMENT ON TABLE public.challenge_modules IS 'Weekly groupings (Week 1-6) within a challenge product';
COMMENT ON TABLE public.challenge_lessons IS 'Individual daily lessons (30 total, M-F for 6 weeks)';
COMMENT ON TABLE public.challenge_purchases IS 'Agency seat purchases for the challenge';
COMMENT ON TABLE public.challenge_assignments IS 'Staff members assigned to a purchased challenge';
COMMENT ON TABLE public.challenge_progress IS 'Lesson-by-lesson completion tracking per assignment';
COMMENT ON TABLE public.challenge_core4_logs IS 'Daily Core 4 habit tracking (Body, Being, Balance, Business)';
COMMENT ON TABLE public.challenge_email_queue IS 'Scheduled daily lesson reminder emails';

COMMENT ON FUNCTION public.get_challenge_business_day IS 'Calculate number of business days (M-F) between two dates';
COMMENT ON FUNCTION public.is_challenge_lesson_unlocked IS 'Check if a lesson is available for a given assignment';
COMMENT ON FUNCTION public.get_next_monday IS 'Get the next Monday from a given date';
COMMENT ON FUNCTION public.get_challenge_price_cents IS 'Get price per seat based on membership tier';
