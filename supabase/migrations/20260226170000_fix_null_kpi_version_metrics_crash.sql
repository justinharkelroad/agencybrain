-- Fix upsert_metrics_from_submission crashing when no KPI version exists.
-- The fallback was leaving kpi_version_id = NULL, violating the CHECK constraint
-- md_version_fields_nonnull on metrics_daily. Per CLAUDE.md rule: if no kpi_version
-- found, skip the INSERT and log a warning.
--
-- Also adds an agency-wide KPI version fallback before giving up.

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

  -- Method 1: From form-level KPI bindings
  IF v_kpi_version_id IS NULL OR v_label_at_submit IS NULL THEN
    SELECT fb.kpi_version_id, kv.label
    INTO v_kpi_version_id, v_label_at_submit
    FROM forms_kpi_bindings fb
    JOIN kpi_versions kv ON kv.id = fb.kpi_version_id
    WHERE fb.form_template_id = s.template_id
      AND kv.valid_to IS NULL
    LIMIT 1;
  END IF;

  -- Method 2: If no binding found, try to auto-bind the form first
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

  -- Method 3: Agency-wide fallback — find ANY active kpi_version for this agency
  IF v_kpi_version_id IS NULL THEN
    SELECT kv.id, kv.label
    INTO v_kpi_version_id, v_label_at_submit
    FROM kpi_versions kv
    JOIN kpis k ON k.id = kv.kpi_id
    WHERE k.agency_id = s.agency_id
      AND kv.valid_to IS NULL
    ORDER BY kv.valid_from DESC
    LIMIT 1;
  END IF;

  -- FINAL: If still no KPI version, skip the metrics insert entirely.
  -- The CHECK constraint md_version_fields_nonnull requires kpi_version_id IS NOT NULL.
  IF v_kpi_version_id IS NULL THEN
    RAISE WARNING 'No KPI version found for submission %, agency %. Skipping metrics insert.', p_submission, s.agency_id;
    RETURN;
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
  w_out := coalesce(floor((tmap->>'outbound_calls')::numeric)::int, 0);
  w_talk := coalesce(floor((tmap->>'talk_minutes')::numeric)::int, 0);
  w_quoted := coalesce(NULLIF(floor((tmap->>'quoted_households')::numeric)::int, 0), floor((tmap->>'quoted_count')::numeric)::int, 0);
  w_items := coalesce(NULLIF(floor((tmap->>'items_sold')::numeric)::int, 0), floor((tmap->>'sold_items')::numeric)::int, 0);
  w_pols := coalesce(floor((tmap->>'sold_policies')::numeric)::int, 0);
  w_prem := coalesce(floor((tmap->>'sold_premium')::numeric)::int, 0);
  w_csu := coalesce(floor((tmap->>'cross_sells_uncovered')::numeric)::int, 0);
  w_mr := coalesce(floor((tmap->>'mini_reviews')::numeric)::int, 0);

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

  -- hits/pass calculated here for the initial insert, but the AFTER trigger
  -- trg_metrics_daily_recalc_hits_pass will recalculate from stored values.
  -- Use n_required (not array_length) per supabase/CLAUDE.md Rule 5.
  pass := (hits >= COALESCE(rules.n_required, 2));

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
    quoted_count = GREATEST(COALESCE(metrics_daily.quoted_count, 0), EXCLUDED.quoted_count),
    quoted_entity = EXCLUDED.quoted_entity,
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
