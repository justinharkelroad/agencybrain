-- ============================================================================
-- Fix: hits/pass/daily_score calculated from form payload values instead of
-- actual stored metric values in metrics_daily
--
-- Root cause: upsert_metrics_from_submission computes hits/pass using form
-- payload values (e.g., qc=0 from form), then stores
-- GREATEST(existing, form_value) for quoted_count. But hits/pass were computed
-- from the form value, not the post-GREATEST stored value.
--
-- Additionally, increment_metrics_quoted_count (dashboard "Add Quote") and
-- sync triggers (call metrics, sales) update metric values without
-- recalculating hits/pass.
--
-- Fix: AFTER trigger on metrics_daily that recalculates hits/pass/score from
-- actual stored values whenever metric columns change. This covers ALL write
-- paths without modifying existing functions.
-- ============================================================================


-- ============================================================================
-- STEP 1: Create recalculation helper function
--
-- Reads stored metric values from the metrics_daily row, looks up scorecard
-- rules and targets, and recomputes hits/pass/daily_score. Only writes back
-- if values actually changed.
-- ============================================================================

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
  w_out int; w_talk int; w_quoted int; w_items int;
  w_pols int; w_prem int; w_csu int; w_mr int;
BEGIN
  -- Read current metrics_daily row (after GREATEST has been applied)
  SELECT * INTO m
  FROM metrics_daily
  WHERE team_member_id = p_team_member_id AND date = p_date;

  IF m IS NULL THEN RETURN; END IF;

  -- Get scorecard rules for this agency + role
  SELECT * INTO rules
  FROM scorecard_rules
  WHERE agency_id = m.agency_id AND role = m.role
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

  -- Extract weights from scorecard rules
  tmap := coalesce(rules.weights, '{}'::jsonb);
  w_out := coalesce((tmap->>'outbound_calls')::int, 0);
  w_talk := coalesce((tmap->>'talk_minutes')::int, 0);
  w_quoted := coalesce(NULLIF((tmap->>'quoted_households')::int, 0),
                       (tmap->>'quoted_count')::int, 0);
  w_items := coalesce(NULLIF((tmap->>'items_sold')::int, 0),
                      (tmap->>'sold_items')::int, 0);
  w_pols := coalesce((tmap->>'sold_policies')::int, 0);
  w_prem := coalesce((tmap->>'sold_premium')::int, 0);
  w_csu := coalesce((tmap->>'cross_sells_uncovered')::int, 0);
  w_mr := coalesce((tmap->>'mini_reviews')::int, 0);

  sel := coalesce(rules.selected_metrics, ARRAY[]::text[]);

  -- -----------------------------------------------------------------------
  -- Calculate hits/score using STORED values (not form payload values).
  -- This is the key fix: we read the actual DB values after GREATEST().
  -- Logic mirrors upsert_metrics_from_submission exactly.
  -- -----------------------------------------------------------------------

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
  -- (matches get_dashboard_daily RPC logic, NOT upsert_metrics_from_submission
  -- which incorrectly used array_length(sel,1) requiring ALL metrics)
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


-- ============================================================================
-- STEP 2: Create AFTER trigger on metrics_daily
--
-- Fires after any INSERT or UPDATE and recalculates hits/pass/score from
-- the stored values. The column-change guard prevents infinite recursion:
-- recalculate_metrics_hits_pass only updates output columns (hits,
-- daily_score, pass) which are NOT in the guard check list.
-- ============================================================================

CREATE OR REPLACE FUNCTION trg_recalculate_metrics_hits_pass()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM recalculate_metrics_hits_pass(NEW.team_member_id, NEW.date);
  ELSIF TG_OP = 'UPDATE' AND (
    -- Input metric columns
    NEW.outbound_calls IS DISTINCT FROM OLD.outbound_calls
    OR NEW.talk_minutes IS DISTINCT FROM OLD.talk_minutes
    OR NEW.quoted_count IS DISTINCT FROM OLD.quoted_count
    OR NEW.sold_items IS DISTINCT FROM OLD.sold_items
    OR NEW.sold_policies IS DISTINCT FROM OLD.sold_policies
    OR NEW.sold_premium_cents IS DISTINCT FROM OLD.sold_premium_cents
    OR NEW.cross_sells_uncovered IS DISTINCT FROM OLD.cross_sells_uncovered
    OR NEW.mini_reviews IS DISTINCT FROM OLD.mini_reviews
    -- Context columns that affect hits/pass calculation
    OR NEW.is_late IS DISTINCT FROM OLD.is_late
    OR NEW.role IS DISTINCT FROM OLD.role
    OR NEW.final_submission_id IS DISTINCT FROM OLD.final_submission_id
  ) THEN
    PERFORM recalculate_metrics_hits_pass(NEW.team_member_id, NEW.date);
  END IF;
  RETURN NEW;
END;
$$;


DROP TRIGGER IF EXISTS trg_metrics_daily_recalc_hits_pass ON metrics_daily;

CREATE TRIGGER trg_metrics_daily_recalc_hits_pass
  AFTER INSERT OR UPDATE ON metrics_daily
  FOR EACH ROW
  EXECUTE FUNCTION trg_recalculate_metrics_hits_pass();


-- ============================================================================
-- STEP 3: Backfill — recalculate hits/pass for recent rows
--
-- Temporarily disables the new trigger during backfill to avoid redundant
-- trigger firings. The function itself handles streak recomputation.
-- ============================================================================

ALTER TABLE metrics_daily DISABLE TRIGGER trg_metrics_daily_recalc_hits_pass;

DO $$
DECLARE
  r record;
  v_total int := 0;
BEGIN
  FOR r IN
    SELECT DISTINCT team_member_id, date
    FROM metrics_daily
    WHERE date >= CURRENT_DATE - 60
    ORDER BY team_member_id, date
  LOOP
    v_total := v_total + 1;
    PERFORM recalculate_metrics_hits_pass(r.team_member_id, r.date);
  END LOOP;

  RAISE NOTICE 'Backfill complete: recalculated hits/pass for % rows', v_total;
END $$;

ALTER TABLE metrics_daily ENABLE TRIGGER trg_metrics_daily_recalc_hits_pass;
