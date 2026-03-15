-- Hybrid Release 2: scoring_role column + read path updates
--
-- Adds scoring_role to metrics_daily to track WHICH role's rules scored each day.
-- This separates "who the team member IS" (role) from "how they were scored" (scoring_role).
-- Enables clean dashboard/report/calendar filtering: Sales tab shows Sales-scored work only,
-- Hybrid tab shows Hybrid-scored work only, etc.

-- =================================================================
-- 1. Add scoring_role column to metrics_daily
-- =================================================================
ALTER TABLE metrics_daily ADD COLUMN IF NOT EXISTS scoring_role app_member_role;

-- =================================================================
-- 2. Backfill scoring_role from submissions → form_templates.role
--    For Hybrid members: resolve from form template, fallback to 'Sales'
--    For non-Hybrid: scoring_role = metrics_daily.role (same thing)
--    For rows with no submission: scoring_role = metrics_daily.role
-- =================================================================
UPDATE metrics_daily md
SET scoring_role = CASE
  WHEN md.role::text = 'Hybrid' THEN
    COALESCE(
      (SELECT ft.role
       FROM submissions sub
       JOIN form_templates ft ON ft.id = sub.form_template_id
       WHERE sub.id = md.final_submission_id
       LIMIT 1),
      'Sales'::app_member_role
    )
  ELSE
    COALESCE(md.role, 'Sales'::app_member_role)
END
WHERE md.scoring_role IS NULL;

-- =================================================================
-- 3. Update recalculate_metrics_hits_pass to persist scoring_role
-- =================================================================
CREATE OR REPLACE FUNCTION recalculate_metrics_hits_pass(
  p_team_member_id uuid,
  p_date date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m record;
  rules record;
  settings jsonb;
  sel text[];
  tmap jsonb;
  nreq int;
  v_hits int := 0;
  v_score int := 0;
  v_pass bool := false;
  v_allow_late boolean := false;
  v_scoring_role text;
  w_out int; w_talk int; w_quoted int; w_items int;
  w_pols int; w_prem int; w_csu int; w_mr int;
BEGIN
  -- Read current metrics_daily row (after GREATEST has been applied)
  SELECT * INTO m
  FROM metrics_daily
  WHERE team_member_id = p_team_member_id AND date = p_date;

  IF m IS NULL THEN RETURN; END IF;

  -- Determine the scoring role for scorecard_rules lookup
  IF m.role = 'Hybrid' THEN
    -- Hybrid members: resolve scoring role from the form template
    IF m.final_submission_id IS NOT NULL THEN
      SELECT ft.role INTO v_scoring_role
      FROM submissions sub
      JOIN form_templates ft ON ft.id = sub.form_template_id
      WHERE sub.id = m.final_submission_id;
    END IF;
    -- Fall back to 'Sales' if no submission or form has no role
    v_scoring_role := coalesce(v_scoring_role, 'Sales');
  ELSE
    v_scoring_role := m.role;
  END IF;

  -- Get scorecard rules for this agency + resolved role
  SELECT * INTO rules
  FROM scorecard_rules
  WHERE agency_id = m.agency_id AND role::text = v_scoring_role
  LIMIT 1;

  -- No rules = nothing to evaluate
  IF rules IS NULL THEN RETURN; END IF;

  -- Get late settings from form template (if submission exists)
  IF m.final_submission_id IS NOT NULL THEN
    SELECT ft.settings_json INTO settings
    FROM submissions sub
    JOIN form_templates ft ON ft.id = sub.form_template_id
    WHERE sub.id = m.final_submission_id;
  END IF;
  settings := coalesce(settings, '{}'::jsonb);
  v_allow_late := coalesce((settings->>'lateCountsForPass')::boolean, false);

  -- Extract weights from scorecard rules (use ::numeric::int to handle decimals)
  tmap := coalesce(rules.weights, '{}'::jsonb);
  w_out := coalesce(floor((tmap->>'outbound_calls')::numeric)::int, 0);
  w_talk := coalesce(floor((tmap->>'talk_minutes')::numeric)::int, 0);
  w_quoted := coalesce(NULLIF(floor((tmap->>'quoted_households')::numeric)::int, 0),
                       floor((tmap->>'quoted_count')::numeric)::int, 0);
  w_items := coalesce(NULLIF(floor((tmap->>'items_sold')::numeric)::int, 0),
                      floor((tmap->>'sold_items')::numeric)::int, 0);
  w_pols := coalesce(floor((tmap->>'sold_policies')::numeric)::int, 0);
  w_prem := coalesce(floor((tmap->>'sold_premium')::numeric)::int, 0);
  w_csu := coalesce(floor((tmap->>'cross_sells_uncovered')::numeric)::int, 0);
  w_mr := coalesce(floor((tmap->>'mini_reviews')::numeric)::int, 0);

  sel := coalesce(rules.selected_metrics, ARRAY[]::text[]);

  -- Calculate hits/score using STORED values (not form payload values).
  IF 'outbound_calls' = ANY(sel) THEN
    nreq := get_target(m.agency_id, p_team_member_id, 'outbound_calls');
    IF COALESCE(m.outbound_calls, 0) >= nreq THEN
      v_hits := v_hits + 1; v_score := v_score + w_out;
    END IF;
  END IF;

  IF 'talk_minutes' = ANY(sel) THEN
    nreq := get_target(m.agency_id, p_team_member_id, 'talk_minutes');
    IF COALESCE(m.talk_minutes, 0) >= nreq THEN
      v_hits := v_hits + 1; v_score := v_score + w_talk;
    END IF;
  END IF;

  IF 'quoted_households' = ANY(sel) OR 'quoted_count' = ANY(sel) THEN
    nreq := coalesce(
      NULLIF(get_target(m.agency_id, p_team_member_id, 'quoted_households'), 0),
      get_target(m.agency_id, p_team_member_id, 'quoted_count')
    );
    IF COALESCE(m.quoted_count, 0) >= nreq THEN
      v_hits := v_hits + 1; v_score := v_score + w_quoted;
    END IF;
  END IF;

  IF 'items_sold' = ANY(sel) OR 'sold_items' = ANY(sel) THEN
    nreq := coalesce(
      NULLIF(get_target(m.agency_id, p_team_member_id, 'items_sold'), 0),
      get_target(m.agency_id, p_team_member_id, 'sold_items')
    );
    IF COALESCE(m.sold_items, 0) >= nreq THEN
      v_hits := v_hits + 1; v_score := v_score + w_items;
    END IF;
  END IF;

  IF 'sold_policies' = ANY(sel) THEN
    nreq := get_target(m.agency_id, p_team_member_id, 'sold_policies');
    IF COALESCE(m.sold_policies, 0) >= nreq THEN
      v_hits := v_hits + 1; v_score := v_score + w_pols;
    END IF;
  END IF;

  IF 'sold_premium' = ANY(sel) THEN
    nreq := get_target(m.agency_id, p_team_member_id, 'sold_premium');
    IF COALESCE(m.sold_premium_cents, 0) >= nreq * 100 THEN
      v_hits := v_hits + 1; v_score := v_score + w_prem;
    END IF;
  END IF;

  IF 'cross_sells_uncovered' = ANY(sel) THEN
    nreq := get_target(m.agency_id, p_team_member_id, 'cross_sells_uncovered');
    IF COALESCE(m.cross_sells_uncovered, 0) >= nreq THEN
      v_hits := v_hits + 1; v_score := v_score + w_csu;
    END IF;
  END IF;

  IF 'mini_reviews' = ANY(sel) THEN
    nreq := get_target(m.agency_id, p_team_member_id, 'mini_reviews');
    IF COALESCE(m.mini_reviews, 0) >= nreq THEN
      v_hits := v_hits + 1; v_score := v_score + w_mr;
    END IF;
  END IF;

  -- Determine pass: hits must meet n_required threshold
  v_pass := (v_hits >= COALESCE(rules.n_required, 2));

  -- Late override: late submissions fail unless lateCountsForPass is true
  IF COALESCE(m.is_late, false) = true AND v_allow_late = false THEN
    v_pass := false;
  END IF;

  -- Only update if values actually changed (avoids unnecessary writes)
  IF m.hits IS DISTINCT FROM v_hits
     OR m.daily_score IS DISTINCT FROM v_score
     OR m.pass IS DISTINCT FROM v_pass
     OR m.scoring_role::text IS DISTINCT FROM v_scoring_role THEN
    UPDATE metrics_daily
    SET hits = v_hits,
        daily_score = v_score,
        pass = v_pass,
        scoring_role = v_scoring_role::app_member_role,
        updated_at = now()
    WHERE team_member_id = p_team_member_id AND date = p_date;

    -- Recompute streaks since pass may have changed
    PERFORM recompute_streaks_for_member(p_team_member_id, p_date - 30, p_date);
  END IF;
END;
$$;

-- =================================================================
-- 4. Update vw_metrics_with_team to include scoring_role
-- =================================================================
DROP VIEW IF EXISTS public.vw_dashboard_yesterday CASCADE;
DROP VIEW IF EXISTS public.vw_dashboard_weekly CASCADE;
DROP VIEW IF EXISTS public.vw_metrics_with_team CASCADE;

CREATE VIEW public.vw_metrics_with_team AS
SELECT
    md.id,
    md.agency_id,
    md.team_member_id,
    md.date,
    md.outbound_calls,
    md.talk_minutes,
    md.quoted_count AS quoted_households,
    md.quoted_entity,
    md.sold_items AS items_sold,
    md.sold_policies,
    md.sold_premium_cents,
    md.cross_sells_uncovered,
    md.mini_reviews,
    md.custom_kpis,
    md.final_submission_id,
    md.pass,
    md.daily_score,
    md.streak_count,
    md.created_at,
    md.updated_at,
    md.role,
    md.scoring_role,
    md.hits,
    md.is_late,
    md.is_counted_day,
    md.metric_slug,
    md.kpi_version_id,
    md.label_at_submit,
    md.submitted_at,
    tm.name AS rep_name,
    tm.name AS team_member_name
FROM metrics_daily md
LEFT JOIN team_members tm ON tm.id = md.team_member_id;

COMMENT ON VIEW public.vw_metrics_with_team IS 'View aliasing database columns to standard UI keys. Includes scoring_role for Hybrid dashboard filtering.';

CREATE VIEW public.vw_dashboard_yesterday AS
SELECT * FROM vw_metrics_with_team
WHERE date = (CURRENT_DATE - INTERVAL '1 day')::date;

CREATE VIEW public.vw_dashboard_weekly AS
SELECT
  agency_id,
  team_member_id,
  team_member_name,
  role,
  scoring_role,
  SUM(outbound_calls) as outbound_calls,
  SUM(talk_minutes) as talk_minutes,
  SUM(quoted_households) as quoted_households,
  SUM(items_sold) as items_sold,
  SUM(cross_sells_uncovered) as cross_sells_uncovered,
  SUM(mini_reviews) as mini_reviews,
  SUM(daily_score) as weekly_score,
  COUNT(*) FILTER (WHERE is_counted_day) as counted_days
FROM vw_metrics_with_team
WHERE date >= (CURRENT_DATE - INTERVAL '7 day')::date
GROUP BY agency_id, team_member_id, team_member_name, role, scoring_role;

-- =================================================================
-- 5. Update get_team_metrics_for_day — filter LEFT JOIN by scoring_role
-- =================================================================
CREATE OR REPLACE FUNCTION public.get_team_metrics_for_day(p_agency uuid, p_role text, p_date date)
RETURNS TABLE (
  team_member_id uuid,
  name text,
  role text,
  date date,
  outbound_calls int,
  talk_minutes int,
  quoted_count int,
  quoted_entity text,
  sold_items int,
  sold_policies int,
  sold_premium_cents int,
  cross_sells_uncovered int,
  mini_reviews int,
  custom_kpis jsonb
) LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT tm.id, tm.name, tm.role::text, p_date,
         coalesce(md.outbound_calls,0), coalesce(md.talk_minutes,0), coalesce(md.quoted_count,0), md.quoted_entity,
         coalesce(md.sold_items,0), coalesce(md.sold_policies,0), coalesce(md.sold_premium_cents,0),
         coalesce(md.cross_sells_uncovered,0), coalesce(md.mini_reviews,0),
         coalesce(md.custom_kpis, '{}'::jsonb)
  FROM team_members tm
  LEFT JOIN metrics_daily md
    ON md.team_member_id = tm.id
    AND md.date = p_date
    AND md.scoring_role::text = p_role
  WHERE tm.agency_id = p_agency
    AND (tm.role::text = p_role
         OR (p_role IN ('Sales', 'Service') AND tm.role::text = 'Hybrid'))
    AND tm.status = 'active'
  ORDER BY tm.name ASC;
$$;

NOTIFY pgrst, 'reload schema';
