-- ============================================================================
-- Fix: Quoted Households not pushing to metrics from Add Quote button
--
-- Root cause: Multiple interacting issues:
-- 1. The increment_metrics_quoted_count function may not have been deployed
--    with the kpi_version fix, causing silent failures on INSERT path
-- 2. upsert_metrics_from_submission overwrites trigger-incremented quoted_count
--    (the GREATEST fix from 20260203 was lost in the 20260205230000 migration)
-- 3. Missing backfill for quoted households added today
--
-- This migration:
-- A. Re-creates increment_metrics_quoted_count with robust UPDATE-first logic
-- B. Re-creates the trigger function with exception handling
-- C. Re-creates the trigger itself (idempotent)
-- D. Restores GREATEST() in upsert_metrics_from_submission ON CONFLICT clause
--    (preserves the improved standard KPI extraction from 20260205230000)
-- E. Backfills today's missing quoted counts from lqs_households data
-- ============================================================================


-- ============================================================================
-- STEP A: Re-create increment_metrics_quoted_count (UPDATE-first, INSERT fallback)
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_metrics_quoted_count(
  p_agency_id uuid,
  p_team_member_id uuid,
  p_date date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kpi_version_id uuid;
  v_label_at_submit text;
  v_updated_count int;
BEGIN
  -- Skip if no team member assigned
  IF p_team_member_id IS NULL THEN
    RAISE LOG 'increment_metrics_quoted_count: Skipping - no team_member_id';
    RETURN;
  END IF;

  -- First, try to UPDATE existing row (most common case - scorecard already submitted)
  UPDATE metrics_daily
  SET
    quoted_count = COALESCE(quoted_count, 0) + 1,
    updated_at = now()
  WHERE team_member_id = p_team_member_id
    AND date = p_date;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  IF v_updated_count > 0 THEN
    RAISE LOG 'increment_metrics_quoted_count: Updated existing row for team_member=%, date=%, rows=%',
      p_team_member_id, p_date, v_updated_count;
    RETURN;
  END IF;

  -- No existing row - need to INSERT with kpi_version_id (required by CHECK constraint)
  -- Find a valid kpi_version for this agency
  SELECT kv.id, kv.label
  INTO v_kpi_version_id, v_label_at_submit
  FROM kpi_versions kv
  JOIN kpis k ON k.id = kv.kpi_id
  WHERE k.agency_id = p_agency_id
    AND kv.valid_to IS NULL
  ORDER BY kv.valid_from DESC
  LIMIT 1;

  -- Fallback: try via form bindings
  IF v_kpi_version_id IS NULL THEN
    SELECT kv.id, kv.label
    INTO v_kpi_version_id, v_label_at_submit
    FROM forms_kpi_bindings fb
    JOIN kpi_versions kv ON kv.id = fb.kpi_version_id
    JOIN form_templates ft ON ft.id = fb.form_template_id
    WHERE ft.agency_id = p_agency_id
      AND kv.valid_to IS NULL
    ORDER BY fb.created_at DESC
    LIMIT 1;
  END IF;

  -- If still no kpi_version, we cannot insert (CHECK constraint would fail)
  IF v_kpi_version_id IS NULL THEN
    RAISE LOG 'increment_metrics_quoted_count: No kpi_version found for agency=%, skipping metrics insert', p_agency_id;
    RETURN;
  END IF;

  -- Insert new metrics_daily row with required fields
  INSERT INTO metrics_daily (
    agency_id,
    team_member_id,
    date,
    quoted_count,
    kpi_version_id,
    label_at_submit,
    role
  )
  VALUES (
    p_agency_id,
    p_team_member_id,
    p_date,
    1,
    v_kpi_version_id,
    v_label_at_submit,
    COALESCE(
      (SELECT tm.role FROM team_members tm WHERE tm.id = p_team_member_id),
      'Sales'::app_member_role
    )
  )
  ON CONFLICT (team_member_id, date) DO UPDATE SET
    quoted_count = COALESCE(metrics_daily.quoted_count, 0) + 1,
    updated_at = now();

  RAISE LOG 'increment_metrics_quoted_count: Inserted/upserted for team_member=%, date=%, kpi_version=%',
    p_team_member_id, p_date, v_kpi_version_id;
END;
$$;


-- ============================================================================
-- STEP B: Re-create trigger function with exception handling
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_quoted_count_from_lqs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check skip flag (set by scorecard sync to prevent double-counting)
  IF NEW.skip_metrics_increment = true THEN
    RAISE LOG 'increment_quoted_count_from_lqs: Skipping (flag set) household=%', NEW.id;
    NEW.skip_metrics_increment := false;  -- Reset flag
    RETURN NEW;
  END IF;

  -- Increment when:
  -- 1. New household created with status='quoted', OR
  -- 2. Existing household promoted from 'lead' to 'quoted'

  IF TG_OP = 'INSERT' AND NEW.status = 'quoted' THEN
    BEGIN
      PERFORM increment_metrics_quoted_count(
        NEW.agency_id,
        NEW.team_member_id,
        COALESCE(NEW.first_quote_date, CURRENT_DATE)
      );
    EXCEPTION WHEN OTHERS THEN
      -- Log but don't fail the household insert
      RAISE WARNING 'increment_quoted_count_from_lqs: Failed to increment metrics for household=% error=%', NEW.id, SQLERRM;
    END;
  ELSIF TG_OP = 'UPDATE'
    AND OLD.status = 'lead'
    AND NEW.status = 'quoted' THEN
    BEGIN
      PERFORM increment_metrics_quoted_count(
        NEW.agency_id,
        NEW.team_member_id,
        COALESCE(NEW.first_quote_date, CURRENT_DATE)
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'increment_quoted_count_from_lqs: Failed to increment metrics for household=% error=%', NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;


-- ============================================================================
-- STEP C: Re-create trigger (idempotent)
-- ============================================================================

DROP TRIGGER IF EXISTS lqs_households_update_metrics ON lqs_households;

CREATE TRIGGER lqs_households_update_metrics
  BEFORE INSERT OR UPDATE ON lqs_households
  FOR EACH ROW
  EXECUTE FUNCTION increment_quoted_count_from_lqs();


-- ============================================================================
-- STEP D: Restore GREATEST() in upsert_metrics_from_submission
--
-- The migration 20260205230000 improved KPI extraction (standard KPIs with
-- custom_kpi_* field keys) but accidentally dropped the GREATEST() fix from
-- 20260203105035. This re-creates the function preserving the improved
-- extraction logic while restoring GREATEST() for quoted_count and sold_items.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.upsert_metrics_from_submission(
  p_submission uuid,
  p_kpi_version_id uuid DEFAULT NULL,
  p_label_at_submit text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  s record;
  role_txt app_member_role;
  rules record;
  settings jsonb;
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
  v_kpi_version_id uuid;
  v_label_at_submit text;
  -- Custom KPI variables
  v_custom_kpis JSONB := '{}';
  v_form_schema JSONB;
  v_kpi_elem JSONB;
  v_payload_key TEXT;
  v_stripped_key TEXT;
  v_selected_kpi_slug TEXT;
  v_kpi_value NUMERIC;
  v_raw_text TEXT;
BEGIN
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

  v_kpi_version_id := p_kpi_version_id;
  v_label_at_submit := p_label_at_submit;

  IF v_kpi_version_id IS NULL OR v_label_at_submit IS NULL THEN
    SELECT fb.kpi_version_id, kv.label
    INTO v_kpi_version_id, v_label_at_submit
    FROM forms_kpi_bindings fb
    JOIN kpi_versions kv ON kv.id = fb.kpi_version_id
    WHERE fb.form_template_id = s.template_id
      AND kv.valid_to IS NULL
    LIMIT 1;
  END IF;

  -- Relaxed: If no binding found, try to auto-bind the form first
  IF v_kpi_version_id IS NULL THEN
    PERFORM bind_form_kpis(s.template_id);
    SELECT fb.kpi_version_id, kv.label
    INTO v_kpi_version_id, v_label_at_submit
    FROM forms_kpi_bindings fb
    JOIN kpi_versions kv ON kv.id = fb.kpi_version_id
    WHERE fb.form_template_id = s.template_id
      AND kv.valid_to IS NULL
    LIMIT 1;
  END IF;

  -- Fallback: use placeholder if still no binding
  IF v_kpi_version_id IS NULL THEN
    v_kpi_version_id := NULL;
    v_label_at_submit := 'unbound';
  END IF;

  settings := coalesce(s.settings, '{}'::jsonb);
  allow_late := coalesce((settings->>'lateCountsForPass')::boolean, false);
  agency_id := s.agency_id;
  role_txt := coalesce(s.role_txt, 'Sales');
  the_date := s.d;
  late := coalesce(s.late, false);

  SELECT *
  INTO rules
  FROM scorecard_rules
  WHERE scorecard_rules.agency_id = s.agency_id
    AND scorecard_rules.role = role_txt
  LIMIT 1;

  IF rules IS NULL THEN
    INSERT INTO scorecard_rules(agency_id, role)
    VALUES (s.agency_id, role_txt)
    RETURNING * INTO rules;
  END IF;

  counted := coalesce(rules.counted_days, '{}'::jsonb);
  count_if_submit := coalesce(rules.count_weekend_if_submitted, true);

  -- Extract standard KPI values from payload (direct column name lookup)
  oc := _nz_int(s.p->'outbound_calls');
  tm := _nz_int(s.p->'talk_minutes');
  qc := _nz_int(COALESCE(s.p->'quoted_households', s.p->'quoted_count'));
  qe := nullif(coalesce(s.p->>'quoted_entity',''), '');
  si := _nz_int(COALESCE(s.p->'items_sold', s.p->'sold_items'));
  so := _nz_int(s.p->'sold_policies');

  BEGIN
    sp := floor(_nz_num(s.p->'sold_premium')*100)::int;
  EXCEPTION WHEN OTHERS THEN
    sp := 0;
  END;
  sp_cents := sp;

  csu := _nz_int(s.p->'cross_sells_uncovered');
  mr := _nz_int(s.p->'mini_reviews');

  -- ============================================
  -- IMPROVED: Extract KPI values from form schema for ALL KPI types
  -- This handles:
  -- 1. Custom KPIs (slug starts with 'custom_') -> store in custom_kpis JSONB
  -- 2. Standard KPIs (slug like 'outbound_calls') with custom_kpi_* field keys
  --    -> update the corresponding standard column variable
  -- 3. preselected_kpi_N_* field keys -> strip prefix and look up value
  -- ============================================
  BEGIN
    SELECT ft.schema_json INTO v_form_schema
    FROM form_templates ft
    WHERE ft.id = s.template_id;

    IF v_form_schema IS NOT NULL AND v_form_schema->'kpis' IS NOT NULL THEN
      FOR v_kpi_elem IN SELECT * FROM jsonb_array_elements(v_form_schema->'kpis')
      LOOP
        v_payload_key := v_kpi_elem->>'key';
        v_selected_kpi_slug := v_kpi_elem->>'selectedKpiSlug';

        -- Skip if no KPI association
        IF v_selected_kpi_slug IS NULL OR v_selected_kpi_slug = '' THEN
          CONTINUE;
        END IF;

        -- Find the value in the payload
        v_kpi_value := NULL;
        v_raw_text := NULL;

        -- Method 1: Direct key lookup (custom_kpi_* or any field key format)
        IF v_payload_key IS NOT NULL THEN
          v_raw_text := s.p->>v_payload_key;
        END IF;

        -- Method 2: Stripped key lookup (preselected_kpi_N_<column> -> <column>)
        IF v_raw_text IS NULL AND v_payload_key LIKE 'preselected_kpi_%' THEN
          v_stripped_key := regexp_replace(v_payload_key, '^preselected_kpi_\d+_', '');
          v_raw_text := s.p->>v_stripped_key;
        END IF;

        -- Method 3: Try the slug itself as a payload key (for legacy forms)
        IF v_raw_text IS NULL THEN
          v_raw_text := s.p->>v_selected_kpi_slug;
        END IF;

        -- Safe numeric cast: skip empty strings and non-numeric values
        IF v_raw_text IS NOT NULL AND v_raw_text <> '' THEN
          BEGIN
            v_kpi_value := v_raw_text::numeric;
          EXCEPTION WHEN OTHERS THEN
            v_kpi_value := NULL;
          END;
        END IF;

        -- Route the value to the correct storage location
        IF v_kpi_value IS NOT NULL THEN
          IF v_selected_kpi_slug LIKE 'custom_%' THEN
            -- Custom KPI -> store in custom_kpis JSONB
            v_custom_kpis := v_custom_kpis || jsonb_build_object(v_selected_kpi_slug, v_kpi_value);
          ELSE
            -- Standard KPI slug -> update the corresponding standard column variable
            -- This handles forms where field keys are custom_kpi_* but the KPI is standard
            CASE v_selected_kpi_slug
              WHEN 'outbound_calls' THEN
                oc := v_kpi_value::int;
              WHEN 'talk_minutes' THEN
                tm := v_kpi_value::int;
              WHEN 'quoted_households', 'quoted_count' THEN
                qc := v_kpi_value::int;
              WHEN 'items_sold', 'sold_items' THEN
                si := v_kpi_value::int;
              WHEN 'sold_policies' THEN
                so := v_kpi_value::int;
              WHEN 'sold_premium' THEN
                sp := floor(v_kpi_value * 100)::int;
                sp_cents := sp;
              WHEN 'cross_sells_uncovered' THEN
                csu := v_kpi_value::int;
              WHEN 'mini_reviews' THEN
                mr := v_kpi_value::int;
              ELSE
                -- Unknown standard slug - store in custom_kpis as fallback
                v_custom_kpis := v_custom_kpis || jsonb_build_object(v_selected_kpi_slug, v_kpi_value);
            END CASE;
          END IF;
        END IF;
      END LOOP;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error extracting KPIs for submission %: %', p_submission, SQLERRM;
    v_custom_kpis := '{}';
  END;

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
    flag := true;
  END IF;

  tmap := coalesce(rules.weights, '{}'::jsonb);
  w_out := coalesce((tmap->>'outbound_calls')::int, 0);
  w_talk := coalesce((tmap->>'talk_minutes')::int, 0);
  w_quoted := coalesce(NULLIF((tmap->>'quoted_households')::int, 0), (tmap->>'quoted_count')::int, 0);
  w_items := coalesce(NULLIF((tmap->>'items_sold')::int, 0), (tmap->>'sold_items')::int, 0);
  w_pols := coalesce((tmap->>'sold_policies')::int, 0);
  w_prem := coalesce((tmap->>'sold_premium')::int, 0);
  w_csu := coalesce((tmap->>'cross_sells_uncovered')::int, 0);
  w_mr := coalesce((tmap->>'mini_reviews')::int, 0);

  sel := coalesce(rules.selected_metrics, ARRAY[]::text[]);

  IF 'outbound_calls' = ANY(sel) THEN
    nreq := get_target(agency_id, s.tm_id, 'outbound_calls');
    IF oc >= nreq THEN hits := hits + 1; score := score + w_out; END IF;
  END IF;

  IF 'talk_minutes' = ANY(sel) THEN
    nreq := get_target(agency_id, s.tm_id, 'talk_minutes');
    IF tm >= nreq THEN hits := hits + 1; score := score + w_talk; END IF;
  END IF;

  IF 'quoted_households' = ANY(sel) OR 'quoted_count' = ANY(sel) THEN
    nreq := coalesce(
      NULLIF(get_target(agency_id, s.tm_id, 'quoted_households'), 0),
      get_target(agency_id, s.tm_id, 'quoted_count')
    );
    IF qc >= nreq THEN hits := hits + 1; score := score + w_quoted; END IF;
  END IF;

  IF 'items_sold' = ANY(sel) OR 'sold_items' = ANY(sel) THEN
    nreq := coalesce(
      NULLIF(get_target(agency_id, s.tm_id, 'items_sold'), 0),
      get_target(agency_id, s.tm_id, 'sold_items')
    );
    IF si >= nreq THEN hits := hits + 1; score := score + w_items; END IF;
  END IF;

  IF 'sold_policies' = ANY(sel) THEN
    nreq := get_target(agency_id, s.tm_id, 'sold_policies');
    IF so >= nreq THEN hits := hits + 1; score := score + w_pols; END IF;
  END IF;

  IF 'sold_premium' = ANY(sel) THEN
    nreq := get_target(agency_id, s.tm_id, 'sold_premium');
    IF sp >= nreq * 100 THEN hits := hits + 1; score := score + w_prem; END IF;
  END IF;

  IF 'cross_sells_uncovered' = ANY(sel) THEN
    nreq := get_target(agency_id, s.tm_id, 'cross_sells_uncovered');
    IF csu >= nreq THEN hits := hits + 1; score := score + w_csu; END IF;
  END IF;

  IF 'mini_reviews' = ANY(sel) THEN
    nreq := get_target(agency_id, s.tm_id, 'mini_reviews');
    IF mr >= nreq THEN hits := hits + 1; score := score + w_mr; END IF;
  END IF;

  IF array_length(sel, 1) IS NOT NULL AND array_length(sel, 1) > 0 THEN
    pass := (hits >= array_length(sel, 1));
  ELSE
    pass := true;
  END IF;

  IF late = true AND allow_late = false THEN
    pass := false;
  END IF;

  INSERT INTO metrics_daily (
    agency_id, team_member_id, date, role,
    outbound_calls, talk_minutes, quoted_count, quoted_entity,
    sold_items, sold_policies, sold_premium_cents,
    cross_sells_uncovered, mini_reviews,
    custom_kpis,
    is_counted_day, is_late, hits, daily_score, pass,
    final_submission_id, submitted_at,
    kpi_version_id, label_at_submit
  )
  VALUES (
    agency_id, s.tm_id, the_date, role_txt,
    oc, tm, qc, qe,
    si, so, sp_cents,
    csu, mr,
    v_custom_kpis,
    flag, late, hits, score, pass,
    p_submission, now(),
    v_kpi_version_id, v_label_at_submit
  )
  ON CONFLICT (team_member_id, date) DO UPDATE SET
    role = EXCLUDED.role,
    outbound_calls = EXCLUDED.outbound_calls,
    talk_minutes = EXCLUDED.talk_minutes,
    -- CRITICAL: Use GREATEST to preserve dashboard-added quoted counts
    quoted_count = GREATEST(COALESCE(metrics_daily.quoted_count, 0), EXCLUDED.quoted_count),
    quoted_entity = EXCLUDED.quoted_entity,
    -- CRITICAL: Use GREATEST to preserve dashboard-added sold item counts
    sold_items = GREATEST(COALESCE(metrics_daily.sold_items, 0), EXCLUDED.sold_items),
    sold_policies = EXCLUDED.sold_policies,
    sold_premium_cents = EXCLUDED.sold_premium_cents,
    cross_sells_uncovered = EXCLUDED.cross_sells_uncovered,
    mini_reviews = EXCLUDED.mini_reviews,
    custom_kpis = EXCLUDED.custom_kpis,
    is_counted_day = EXCLUDED.is_counted_day,
    is_late = EXCLUDED.is_late,
    hits = EXCLUDED.hits,
    daily_score = EXCLUDED.daily_score,
    pass = EXCLUDED.pass,
    final_submission_id = EXCLUDED.final_submission_id,
    submitted_at = EXCLUDED.submitted_at,
    kpi_version_id = EXCLUDED.kpi_version_id,
    label_at_submit = EXCLUDED.label_at_submit,
    updated_at = now();

  PERFORM recompute_streaks_for_member(s.tm_id, the_date - 30, the_date);
END;
$function$;


-- ============================================================================
-- STEP E: Backfill today's quoted counts from lqs_households
-- For any team member who has quoted households today but metrics shows 0
-- ============================================================================

DO $$
DECLARE
  v_today date := CURRENT_DATE;
  v_fixed int := 0;
  r record;
BEGIN
  -- Find team members with quoted households today whose metrics don't reflect it
  FOR r IN
    SELECT
      h.agency_id,
      h.team_member_id,
      COUNT(DISTINCT h.id) as actual_quoted
    FROM lqs_households h
    WHERE h.status IN ('quoted', 'sold')
      AND h.first_quote_date = v_today
      AND h.team_member_id IS NOT NULL
      AND h.skip_metrics_increment = false
    GROUP BY h.agency_id, h.team_member_id
  LOOP
    -- Update metrics_daily if quoted_count is lower than actual
    UPDATE metrics_daily md
    SET
      quoted_count = r.actual_quoted,
      updated_at = now()
    WHERE md.team_member_id = r.team_member_id
      AND md.date = v_today
      AND COALESCE(md.quoted_count, 0) < r.actual_quoted;

    IF FOUND THEN
      v_fixed := v_fixed + 1;
      RAISE NOTICE 'Backfilled quoted_count=% for team_member=% on %',
        r.actual_quoted, r.team_member_id, v_today;
    END IF;
  END LOOP;

  RAISE NOTICE 'Backfill complete: fixed % team member metrics for today', v_fixed;
END $$;
