-- Fix Hybrid role pass/fail calculation
-- Problem: recalculate_metrics_hits_pass() looks up scorecard_rules by metrics_daily.role,
-- but there are no scorecard_rules for 'Hybrid'. It returns early → pass stays false → always red.
-- Solution: When role='Hybrid', resolve the actual scoring role from the linked form_template,
-- falling back to 'Sales' if no submission exists.

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
  -- This is the key fix: we read the actual DB values after GREATEST().
  -- Logic mirrors upsert_metrics_from_submission exactly.

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
     OR m.pass IS DISTINCT FROM v_pass THEN
    UPDATE metrics_daily
    SET hits = v_hits,
        daily_score = v_score,
        pass = v_pass,
        updated_at = now()
    WHERE team_member_id = p_team_member_id AND date = p_date;

    -- Recompute streaks since pass may have changed
    PERFORM recompute_streaks_for_member(p_team_member_id, p_date - 30, p_date);
  END IF;
END;
$$;

-- Backfill: recalculate hits/pass for all Hybrid rows in the last 60 days
-- Disable trigger during backfill to avoid redundant trigger firings
ALTER TABLE metrics_daily DISABLE TRIGGER trg_metrics_daily_recalc_hits_pass;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT team_member_id, date
    FROM metrics_daily
    WHERE role::text = 'Hybrid'
      AND date >= CURRENT_DATE - INTERVAL '60 days'
    ORDER BY date
  LOOP
    BEGIN
      PERFORM recalculate_metrics_hits_pass(r.team_member_id, r.date);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to recalculate for tm=%, date=%: %', r.team_member_id, r.date, SQLERRM;
    END;
  END LOOP;
END;
$$;

ALTER TABLE metrics_daily ENABLE TRIGGER trg_metrics_daily_recalc_hits_pass;
