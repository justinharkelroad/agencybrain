-- Phase 2: Targets + Pass/Score/Streak + metrics_daily

-- 2.1 Targets per metric (global default per agency and optional per-rep override)
CREATE TABLE IF NOT EXISTS targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  team_member_id uuid REFERENCES team_members(id) ON DELETE CASCADE, -- null = global default
  metric_key text NOT NULL,                                          -- e.g. outbound_calls
  value_number numeric(12,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_agency_member_metric UNIQUE (agency_id, team_member_id, metric_key)
);

-- 2.2 Scorecard rules per role (Sales/Service) - using correct enum values
CREATE TABLE IF NOT EXISTS scorecard_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  role app_member_role NOT NULL,
  selected_metrics text[] NOT NULL DEFAULT ARRAY['outbound_calls','talk_minutes','quoted_count','sold_items'],
  n_required int NOT NULL DEFAULT 2 CHECK (n_required BETWEEN 1 AND 8),
  weights jsonb NOT NULL DEFAULT '{"outbound_calls":10,"talk_minutes":20,"quoted_count":30,"sold_items":40}'::jsonb,
  backfill_days int NOT NULL DEFAULT 7,
  counted_days jsonb NOT NULL DEFAULT '{"monday":true,"tuesday":true,"wednesday":true,"thursday":true,"friday":true,"saturday":false,"sunday":false}'::jsonb,
  count_weekend_if_submitted boolean NOT NULL DEFAULT true,
  recalc_past_on_change boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_agency_role UNIQUE (agency_id, role)
);

-- 2.3 Daily metrics snapshot (one row per rep/day) - extend existing table
-- First drop the existing constraint and recreate with correct structure
ALTER TABLE metrics_daily DROP CONSTRAINT IF EXISTS metrics_daily_agency_id_team_member_id_date_key;

-- Add missing columns to existing metrics_daily table
ALTER TABLE metrics_daily 
  ADD COLUMN IF NOT EXISTS role app_member_role DEFAULT 'Sales',
  ADD COLUMN IF NOT EXISTS quoted_entity text DEFAULT 'Households',
  ADD COLUMN IF NOT EXISTS pass boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hits integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_late boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_counted_day boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS streak_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_submission_id uuid REFERENCES submissions(id) ON DELETE SET NULL;

-- Ensure updated_at exists
ALTER TABLE metrics_daily 
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_metrics_daily_agency_date ON metrics_daily(agency_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_daily_member_date ON metrics_daily(team_member_id, date DESC);

-- Re-add the unique constraint
ALTER TABLE metrics_daily ADD CONSTRAINT unique_member_date UNIQUE (team_member_id, date);

-- 2.4 Helpers: normalize numbers safely
CREATE OR REPLACE FUNCTION _nz_int(v jsonb) 
RETURNS int 
LANGUAGE sql 
IMMUTABLE AS $$
  SELECT coalesce((v)::text::numeric,0)::int
$$;

CREATE OR REPLACE FUNCTION _nz_num(v jsonb) 
RETURNS numeric 
LANGUAGE sql 
IMMUTABLE AS $$
  SELECT coalesce((v)::text::numeric,0)
$$;

-- 2.5 Helper: fetch target (per-rep override else global)
CREATE OR REPLACE FUNCTION get_target(p_agency uuid, p_member uuid, p_metric text)
RETURNS numeric 
LANGUAGE sql 
STABLE AS $$
  WITH t AS (
    SELECT value_number
    FROM targets
    WHERE agency_id = p_agency 
      AND metric_key = p_metric 
      AND (team_member_id IS NULL OR team_member_id = p_member)
    ORDER BY team_member_id NULLS LAST
    LIMIT 1
  )
  SELECT coalesce((SELECT value_number FROM t), 0)
$$;

-- 2.6 Compute pass/score/hits for a given submission and upsert metrics_daily
CREATE OR REPLACE FUNCTION upsert_metrics_from_submission(p_submission uuid)
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER AS $$
DECLARE
  s record;
  role_txt app_member_role;
  rules record;
  settings jsonb;
  -- extracted KPI values
  oc int; tm int; qc int; qe text; si int; sp int; sp_cents int; so int;
  csu int; mr int;
  the_date date;
  counted jsonb;
  count_if_submit boolean;
  tmap jsonb;
  w_out int; w_talk int; w_quoted int; w_items int; w_pols int; w_prem int; w_csu int; w_mr int;
  sel text[];
  nreq int;
  hits int := 0;
  score int := 0;
  pass bool := false;
  late bool := false;
  allow_late boolean := false;
  agency_id uuid;
  wd int;
  flag boolean;
BEGIN
  -- load submission + template + agency + team role
  SELECT
    sub.id as submission_id, 
    sub.final, 
    sub.late,
    coalesce(sub.work_date, sub.submission_date) as d,
    sub.payload_json as p,
    ft.id as template_id, 
    ft.settings_json as settings,
    ft.status,
    ag.id as agency_id,
    tm.id as tm_id, 
    tm.role as role_txt
  INTO s
  FROM submissions sub
  JOIN form_templates ft ON ft.id = sub.form_template_id
  JOIN agencies ag ON ag.id = ft.agency_id
  JOIN team_members tm ON tm.id = sub.team_member_id
  WHERE sub.id = p_submission;

  IF s.submission_id IS NULL OR s.final IS false THEN
    RETURN;
  END IF;
  
  IF s.status <> 'published' THEN
    RETURN;
  END IF;

  settings := coalesce(s.settings, '{}'::jsonb);
  allow_late := coalesce((settings->>'lateCountsForPass')::boolean, false);
  agency_id := s.agency_id;
  role_txt := coalesce(s.role_txt, 'Sales');
  the_date := s.d;
  late := coalesce(s.late, false);

  -- scorecard rules for agency+role
  SELECT *
  INTO rules
  FROM scorecard_rules
  WHERE scorecard_rules.agency_id = s.agency_id 
    AND scorecard_rules.role = role_txt
  LIMIT 1;

  IF rules IS NULL THEN
    -- seed minimal rules if missing
    INSERT INTO scorecard_rules(agency_id, role) 
    VALUES (s.agency_id, role_txt) 
    RETURNING * INTO rules;
  END IF;

  counted := coalesce(rules.counted_days, '{}'::jsonb);
  count_if_submit := coalesce(rules.count_weekend_if_submitted, true);

  -- extract KPIs from payload (Sales)
  oc := _nz_int(s.p->'outbound_calls');
  tm := _nz_int(s.p->'talk_minutes');
  qc := _nz_int(s.p->'quoted_count');
  qe := nullif(coalesce(s.p->>'quoted_entity',''), '');
  si := _nz_int(s.p->'sold_items');
  so := _nz_int(s.p->'sold_policies');
  sp := floor(_nz_num(s.p->'sold_premium')*100)::int; -- cents
  sp_cents := sp;

  -- Service KPIs
  csu := _nz_int(s.p->'cross_sells_uncovered');
  mr := _nz_int(s.p->'mini_reviews');

  -- determine if this day is counted
  -- weekday 0=Sunday ... 6=Saturday
  wd := extract(dow from the_date);
  
  IF wd = 0 THEN 
    flag := coalesce((counted->>'sunday')::boolean, false);
  ELSIF wd = 1 THEN 
    flag := coalesce((counted->>'monday')::boolean, false);
  ELSIF wd = 2 THEN 
    flag := coalesce((counted->>'tuesday')::boolean, false);
  ELSIF wd = 3 THEN 
    flag := coalesce((counted->>'wednesday')::boolean, false);
  ELSIF wd = 4 THEN 
    flag := coalesce((counted->>'thursday')::boolean, false);
  ELSIF wd = 5 THEN 
    flag := coalesce((counted->>'friday')::boolean, false);
  ELSE 
    flag := coalesce((counted->>'saturday')::boolean, false);
  END IF;
  
  IF flag = false AND count_if_submit = true THEN
    flag := true; -- count weekend if a submission exists
  END IF;

  -- weight map and selected metrics
  tmap := coalesce(rules.weights, '{}'::jsonb);
  w_out := coalesce((tmap->>'outbound_calls')::int, 0);
  w_talk := coalesce((tmap->>'talk_minutes')::int, 0);
  w_quoted := coalesce((tmap->>'quoted_count')::int, 0);
  w_items := coalesce((tmap->>'sold_items')::int, 0);
  w_pols := coalesce((tmap->>'sold_policies')::int, 0);
  w_prem := coalesce((tmap->>'sold_premium')::int, 0);
  w_csu := coalesce((tmap->>'cross_sells_uncovered')::int, 0);
  w_mr := coalesce((tmap->>'mini_reviews')::int, 0);

  sel := coalesce(rules.selected_metrics, ARRAY['outbound_calls','talk_minutes','quoted_count','sold_items']);
  nreq := rules.n_required;

  -- compute hits (>= target) and score (weight only if > target)
  hits := 0; 
  score := 0;

  IF 'outbound_calls' = ANY(sel) THEN
    IF oc >= get_target(s.agency_id, s.tm_id, 'outbound_calls') THEN 
      hits := hits + 1; 
    END IF;
    IF oc > get_target(s.agency_id, s.tm_id, 'outbound_calls') THEN 
      score := score + w_out; 
    END IF;
  END IF;

  IF 'talk_minutes' = ANY(sel) THEN
    IF tm >= get_target(s.agency_id, s.tm_id, 'talk_minutes') THEN 
      hits := hits + 1; 
    END IF;
    IF tm > get_target(s.agency_id, s.tm_id, 'talk_minutes') THEN 
      score := score + w_talk; 
    END IF;
  END IF;

  IF 'quoted_count' = ANY(sel) THEN
    IF qc >= get_target(s.agency_id, s.tm_id, 'quoted_count') THEN 
      hits := hits + 1; 
    END IF;
    IF qc > get_target(s.agency_id, s.tm_id, 'quoted_count') THEN 
      score := score + w_quoted; 
    END IF;
  END IF;

  IF 'sold_items' = ANY(sel) THEN
    IF si >= get_target(s.agency_id, s.tm_id, 'sold_items') THEN 
      hits := hits + 1; 
    END IF;
    IF si > get_target(s.agency_id, s.tm_id, 'sold_items') THEN 
      score := score + w_items; 
    END IF;
  END IF;

  IF 'sold_policies' = ANY(sel) THEN
    IF so >= get_target(s.agency_id, s.tm_id, 'sold_policies') THEN 
      hits := hits + 1; 
    END IF;
    IF so > get_target(s.agency_id, s.tm_id, 'sold_policies') THEN 
      score := score + w_pols; 
    END IF;
  END IF;

  IF 'sold_premium' = ANY(sel) THEN
    IF sp_cents >= (get_target(s.agency_id, s.tm_id, 'sold_premium')*100)::int THEN 
      hits := hits + 1; 
    END IF;
    IF sp_cents > (get_target(s.agency_id, s.tm_id, 'sold_premium')*100)::int THEN 
      score := score + w_prem; 
    END IF;
  END IF;

  IF 'cross_sells_uncovered' = ANY(sel) THEN
    IF csu >= get_target(s.agency_id, s.tm_id, 'cross_sells_uncovered') THEN 
      hits := hits + 1; 
    END IF;
    IF csu > get_target(s.agency_id, s.tm_id, 'cross_sells_uncovered') THEN 
      score := score + w_csu; 
    END IF;
  END IF;

  IF 'mini_reviews' = ANY(sel) THEN
    IF mr >= get_target(s.agency_id, s.tm_id, 'mini_reviews') THEN 
      hits := hits + 1; 
    END IF;
    IF mr > get_target(s.agency_id, s.tm_id, 'mini_reviews') THEN 
      score := score + w_mr; 
    END IF;
  END IF;

  pass := (hits >= nreq);

  -- late policy: if allow_late=false, late entries do NOT count for pass nor score
  IF late = true AND allow_late = false THEN
    pass := false;
    score := 0;
  END IF;

  -- upsert metrics_daily (last wins)
  INSERT INTO metrics_daily (
    agency_id, team_member_id, role, date,
    outbound_calls, talk_minutes, quoted_count, quoted_entity,
    sold_items, sold_policies, sold_premium_cents,
    cross_sells_uncovered, mini_reviews,
    pass, hits, daily_score, is_late, is_counted_day, final_submission_id, updated_at
  )
  VALUES (
    s.agency_id, s.tm_id, role_txt, the_date,
    oc, tm, qc, qe,
    si, so, sp_cents,
    csu, mr,
    pass, hits, score, late, flag, s.submission_id, now()
  )
  ON CONFLICT (team_member_id, date)
  DO UPDATE SET
    role = EXCLUDED.role,
    outbound_calls = EXCLUDED.outbound_calls,
    talk_minutes = EXCLUDED.talk_minutes,
    quoted_count = EXCLUDED.quoted_count,
    quoted_entity = EXCLUDED.quoted_entity,
    sold_items = EXCLUDED.sold_items,
    sold_policies = EXCLUDED.sold_policies,
    sold_premium_cents = EXCLUDED.sold_premium_cents,
    cross_sells_uncovered = EXCLUDED.cross_sells_uncovered,
    mini_reviews = EXCLUDED.mini_reviews,
    pass = EXCLUDED.pass,
    hits = EXCLUDED.hits,
    daily_score = EXCLUDED.daily_score,
    is_late = EXCLUDED.is_late,
    is_counted_day = EXCLUDED.is_counted_day,
    final_submission_id = EXCLUDED.final_submission_id,
    updated_at = now();
END;
$$;

-- 2.7 Trigger: on final submission insert/update -> recompute day
DROP TRIGGER IF EXISTS trg_after_submission_upsert ON submissions;

CREATE OR REPLACE FUNCTION trg_apply_submission()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    IF NEW.final IS true THEN
      PERFORM upsert_metrics_from_submission(NEW.id);
    END IF;
    RETURN NEW;
  ELSIF (TG_OP = 'UPDATE') THEN
    IF NEW.final IS true AND (
      OLD.final IS DISTINCT FROM NEW.final OR 
      OLD.payload_json IS DISTINCT FROM NEW.payload_json OR 
      OLD.work_date IS DISTINCT FROM NEW.work_date OR 
      OLD.submission_date IS DISTINCT FROM NEW.submission_date OR 
      OLD.late IS DISTINCT FROM NEW.late
    ) THEN
      PERFORM upsert_metrics_from_submission(NEW.id);
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_after_submission_upsert
AFTER INSERT OR UPDATE ON submissions
FOR EACH ROW EXECUTE PROCEDURE trg_apply_submission();

-- 2.8 Streak recompute utility (forward-only for a window)
CREATE OR REPLACE FUNCTION recompute_streaks_for_member(p_member uuid, p_start date, p_end date)
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER AS $$
DECLARE
  r record;
  streak int := 0;
BEGIN
  FOR r IN
    SELECT date, pass, is_counted_day, is_late
    FROM metrics_daily
    WHERE team_member_id = p_member 
      AND date BETWEEN p_start AND p_end
    ORDER BY date ASC
  LOOP
    -- counted day logic: if not counted_day, do not change streak
    IF r.is_counted_day IS false THEN
      CONTINUE;
    END IF;

    -- late or missing breaks streak
    IF r.is_late OR r.pass IS false THEN
      streak := 0;
    ELSE
      streak := streak + 1;
    END IF;

    UPDATE metrics_daily
    SET streak_count = streak,
        updated_at = now()
    WHERE team_member_id = p_member AND date = r.date;
  END LOOP;
END;
$$;

-- 2.9 Backfill: recompute last N days for an agency (idempotent)
CREATE OR REPLACE FUNCTION backfill_metrics_last_n_days(p_agency uuid, p_days int)
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER AS $$
DECLARE
  d date := (now()::date - make_interval(days => p_days));
  rec record;
BEGIN
  -- for each final submission in window, reapply metrics
  FOR rec IN
    SELECT DISTINCT s.id
    FROM submissions s
    JOIN form_templates ft ON ft.id = s.form_template_id
    WHERE ft.agency_id = p_agency
      AND coalesce(s.work_date, s.submission_date) >= d
      AND s.final IS true
  LOOP
    PERFORM upsert_metrics_from_submission(rec.id);
  END LOOP;
END;
$$;