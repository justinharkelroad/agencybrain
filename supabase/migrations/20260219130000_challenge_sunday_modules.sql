-- =====================================================
-- Challenge Sunday Modules
-- Optional weekly commitment/review modules (Sundays 0-6)
-- These do NOT affect the 30-lesson completion percentage
-- =====================================================

-- =====================================================
-- 1. TABLES
-- =====================================================

-- 1.1 Sunday Module Definitions (admin-customizable)
CREATE TABLE IF NOT EXISTS public.challenge_sunday_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_product_id uuid NOT NULL REFERENCES public.challenge_products(id) ON DELETE CASCADE,
  sunday_number integer NOT NULL CHECK (sunday_number >= 0 AND sunday_number <= 6),
  title text NOT NULL,
  blurb_html text,
  video_url text,
  video_thumbnail_url text,
  -- Structural flags (determine which form sections appear)
  has_rating_section boolean NOT NULL DEFAULT false,
  has_commitment_section boolean NOT NULL DEFAULT true,
  has_final_reflection boolean NOT NULL DEFAULT false,
  final_reflection_prompt text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(challenge_product_id, sunday_number)
);

CREATE INDEX IF NOT EXISTS idx_challenge_sunday_modules_product
  ON public.challenge_sunday_modules(challenge_product_id);

-- 1.2 Sunday Responses (staff form submissions)
CREATE TABLE IF NOT EXISTS public.challenge_sunday_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.challenge_assignments(id) ON DELETE CASCADE,
  sunday_module_id uuid NOT NULL REFERENCES public.challenge_sunday_modules(id) ON DELETE CASCADE,
  staff_user_id uuid NOT NULL REFERENCES public.staff_users(id) ON DELETE CASCADE,
  sunday_number integer NOT NULL CHECK (sunday_number >= 0 AND sunday_number <= 6),
  -- Rating section (Sundays 1-6: rate previous week 1-10)
  rating_body integer CHECK (rating_body IS NULL OR (rating_body >= 1 AND rating_body <= 10)),
  rating_being integer CHECK (rating_being IS NULL OR (rating_being >= 1 AND rating_being <= 10)),
  rating_balance integer CHECK (rating_balance IS NULL OR (rating_balance >= 1 AND rating_balance <= 10)),
  rating_business integer CHECK (rating_business IS NULL OR (rating_business >= 1 AND rating_business <= 10)),
  -- Accomplished flags (Sundays 1-6: did you accomplish last week's commitment?)
  accomplished_body boolean,
  accomplished_being boolean,
  accomplished_balance boolean,
  accomplished_business boolean,
  -- Commitment section (Sundays 0-5: what will you accomplish this week?)
  commitment_body text,
  commitment_being text,
  commitment_balance text,
  commitment_business text,
  -- Final reflection (Sunday 6 only)
  final_reflection text,
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(assignment_id, sunday_number)
);

CREATE INDEX IF NOT EXISTS idx_challenge_sunday_responses_assignment
  ON public.challenge_sunday_responses(assignment_id);
CREATE INDEX IF NOT EXISTS idx_challenge_sunday_responses_staff
  ON public.challenge_sunday_responses(staff_user_id);

-- =====================================================
-- 2. ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.challenge_sunday_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_sunday_responses ENABLE ROW LEVEL SECURITY;

-- Sunday module definitions: public read (same as challenge_lessons)
DROP POLICY IF EXISTS "challenge_sunday_modules_select" ON public.challenge_sunday_modules;
CREATE POLICY "challenge_sunday_modules_select" ON public.challenge_sunday_modules
FOR SELECT USING (true);

-- Sunday module definitions: admin write (via service role)
DROP POLICY IF EXISTS "challenge_sunday_modules_all" ON public.challenge_sunday_modules;
CREATE POLICY "challenge_sunday_modules_all" ON public.challenge_sunday_modules
FOR ALL USING (true) WITH CHECK (true);

-- Sunday responses: service role access (accessed via edge functions, same as challenge_progress)
DROP POLICY IF EXISTS "challenge_sunday_responses_service" ON public.challenge_sunday_responses;
CREATE POLICY "challenge_sunday_responses_service" ON public.challenge_sunday_responses
FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- 3. TRIGGERS (updated_at)
-- =====================================================

DROP TRIGGER IF EXISTS update_challenge_sunday_modules_updated_at ON public.challenge_sunday_modules;
CREATE TRIGGER update_challenge_sunday_modules_updated_at
BEFORE UPDATE ON public.challenge_sunday_modules
FOR EACH ROW EXECUTE FUNCTION public.update_challenge_updated_at();

DROP TRIGGER IF EXISTS update_challenge_sunday_responses_updated_at ON public.challenge_sunday_responses;
CREATE TRIGGER update_challenge_sunday_responses_updated_at
BEFORE UPDATE ON public.challenge_sunday_responses
FOR EACH ROW EXECUTE FUNCTION public.update_challenge_updated_at();

-- =====================================================
-- 4. SEED DATA: 7 Sunday modules for existing product
-- =====================================================

INSERT INTO public.challenge_sunday_modules (
  challenge_product_id, sunday_number, title, blurb_html,
  has_rating_section, has_commitment_section, has_final_reflection,
  final_reflection_prompt
)
VALUES
  -- Sunday 0: "The One Thing" (before Week 1)
  (
    'a0000000-0000-0000-0000-000000000001'::uuid,
    0,
    'The One Thing',
    '<p>Welcome to The Challenge. Before we begin, you need to set your <strong>Core 4 commitments</strong> for the week ahead.</p>
<p>For each of the four domains — <strong>Body, Being, Balance, and Business</strong> — declare <em>one specific thing</em> you will accomplish this week.</p>
<p>Be specific. Be measurable. This is pass/fail — you either did it or you didn''t. "Exercise more" won''t cut it. "Run 3 miles on Monday, Wednesday, and Friday" will.</p>',
    false, true, false, NULL
  ),
  -- Sunday 1: Return & Report — Week 1
  (
    'a0000000-0000-0000-0000-000000000001'::uuid,
    1,
    'Return & Report — Week 1',
    '<p>Time to <strong>Return &amp; Report</strong>. Rate how your week went in each Core 4 domain and honestly assess whether you accomplished your commitment.</p>
<p>Then set your new commitments for the week ahead. Remember: specific, measurable, pass/fail.</p>',
    true, true, false, NULL
  ),
  -- Sunday 2
  (
    'a0000000-0000-0000-0000-000000000001'::uuid,
    2,
    'Return & Report — Week 2',
    '<p>Week 2 is in the books. Time to <strong>Return &amp; Report</strong>.</p>
<p>Rate your week, acknowledge what you accomplished, and set your commitments for Week 3.</p>',
    true, true, false, NULL
  ),
  -- Sunday 3
  (
    'a0000000-0000-0000-0000-000000000001'::uuid,
    3,
    'Return & Report — Week 3',
    '<p>You''re halfway through The Challenge. Time to <strong>Return &amp; Report</strong>.</p>
<p>Rate your week, be honest about your commitments, and set your intentions for Week 4.</p>',
    true, true, false, NULL
  ),
  -- Sunday 4
  (
    'a0000000-0000-0000-0000-000000000001'::uuid,
    4,
    'Return & Report — Week 4',
    '<p>Four weeks down. Time to <strong>Return &amp; Report</strong>.</p>
<p>Rate your week, assess your commitments, and set your goals for Week 5.</p>',
    true, true, false, NULL
  ),
  -- Sunday 5
  (
    'a0000000-0000-0000-0000-000000000001'::uuid,
    5,
    'Return & Report — Week 5',
    '<p>One week to go. Time to <strong>Return &amp; Report</strong>.</p>
<p>Rate your week, assess your commitments, and set your final week''s goals. Make it count.</p>',
    true, true, false, NULL
  ),
  -- Sunday 6: Final Return & Report
  (
    'a0000000-0000-0000-0000-000000000001'::uuid,
    6,
    'Final Return & Report',
    '<p>Congratulations — you''ve completed The Challenge. Time for your <strong>Final Return &amp; Report</strong>.</p>
<p>Rate your final week, then reflect on your entire 6-week journey.</p>',
    true, false, true,
    'Look back on your 6-week journey. What has changed about you? What habits have you built that you''re committed to keeping? What surprised you about yourself? What would you tell someone just starting The Challenge?'
  )
ON CONFLICT (challenge_product_id, sunday_number) DO UPDATE SET
  title = EXCLUDED.title,
  blurb_html = EXCLUDED.blurb_html,
  has_rating_section = EXCLUDED.has_rating_section,
  has_commitment_section = EXCLUDED.has_commitment_section,
  has_final_reflection = EXCLUDED.has_final_reflection,
  final_reflection_prompt = EXCLUDED.final_reflection_prompt,
  updated_at = now();

-- =====================================================
-- 5. COMMENTS
-- =====================================================

COMMENT ON TABLE public.challenge_sunday_modules IS 'Optional Sunday module definitions (0=pre-challenge, 1-5=weekly review, 6=final reflection). Do NOT affect lesson completion percentage.';
COMMENT ON TABLE public.challenge_sunday_responses IS 'Staff responses to Sunday modules: ratings (1-10), accomplished flags, commitments, and final reflection.';
