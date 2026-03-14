-- Weekly Reviews (The Debrief) — end-of-week reflection wizard
-- Auth users: owners / key employees
CREATE TABLE IF NOT EXISTS public.weekly_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  agency_id uuid REFERENCES agencies(id),
  week_key text NOT NULL,                    -- e.g. '2026-W11'
  core4_points int NOT NULL DEFAULT 0,       -- snapshot 0-28
  flow_points int NOT NULL DEFAULT 0,        -- snapshot 0-7
  playbook_points int NOT NULL DEFAULT 0,    -- snapshot 0-20
  total_points int NOT NULL DEFAULT 0,       -- snapshot 0-55
  domain_reflections jsonb DEFAULT '{}',     -- { body: {wins,carry_forward,rating}, ... }
  gratitude_note text,
  next_week_one_big_thing text,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed')),
  completed_at timestamptz,
  current_step int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_user_week UNIQUE (user_id, week_key)
);

ALTER TABLE public.weekly_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own weekly reviews"
  ON public.weekly_reviews FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own weekly reviews"
  ON public.weekly_reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own weekly reviews"
  ON public.weekly_reviews FOR UPDATE
  USING (auth.uid() = user_id);

CREATE INDEX idx_weekly_reviews_user_week ON public.weekly_reviews(user_id, week_key);

-- Staff users: separate table following split-table pattern
CREATE TABLE IF NOT EXISTS public.staff_weekly_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_user_id uuid NOT NULL REFERENCES staff_users(id),
  team_member_id uuid REFERENCES team_members(id),
  agency_id uuid REFERENCES agencies(id),
  week_key text NOT NULL,
  core4_points int NOT NULL DEFAULT 0,
  flow_points int NOT NULL DEFAULT 0,
  playbook_points int NOT NULL DEFAULT 0,
  total_points int NOT NULL DEFAULT 0,
  domain_reflections jsonb DEFAULT '{}',
  gratitude_note text,
  next_week_one_big_thing text,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed')),
  completed_at timestamptz,
  current_step int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_staff_user_week UNIQUE (staff_user_id, week_key)
);

ALTER TABLE public.staff_weekly_reviews ENABLE ROW LEVEL SECURITY;

-- Service role only for staff table (edge functions handle auth via session token)
CREATE POLICY "Service role can manage staff_weekly_reviews"
  ON public.staff_weekly_reviews FOR ALL
  USING (auth.role() = 'service_role');

CREATE INDEX idx_staff_weekly_reviews_staff_week ON public.staff_weekly_reviews(staff_user_id, week_key);
