-- Fix custom KPI extraction to handle forms where custom KPIs use preselected_kpi_N_* field keys
-- The issue: Form schema has custom KPIs (selectedKpiSlug like 'custom_*') but field keys use
-- standard column names (preselected_kpi_2_cross_sells_uncovered), so values go to standard columns
-- but ring display looks in custom_kpis JSONB.
--
-- The fix: Extract custom KPI values from the payload using the form schema mapping,
-- regardless of what field key was used.

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
  v_selected_kpi_id UUID;
  v_kpi_db_key TEXT;
  v_kpi_value NUMERIC;
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

  -- Extract standard KPI values from payload
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
  -- IMPROVED: Extract ALL custom KPI values from form schema
  -- This handles both:
  -- 1. custom_kpi_* field keys (store value under kpis.key)
  -- 2. preselected_kpi_N_* field keys with custom KPI slugs (store value under the custom slug)
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
        v_selected_kpi_id := (v_kpi_elem->>'selectedKpiId')::uuid;

        -- Skip if no custom KPI association
        IF v_selected_kpi_slug IS NULL OR v_selected_kpi_slug = '' THEN
          CONTINUE;
        END IF;

        -- Only process CUSTOM KPIs (slug starts with 'custom_')
        IF v_selected_kpi_slug NOT LIKE 'custom_%' THEN
          CONTINUE;
        END IF;

        -- Find the value in the payload
        v_kpi_value := NULL;

        -- Method 1: Direct key lookup (custom_kpi_* format)
        IF v_payload_key IS NOT NULL AND s.p->>v_payload_key IS NOT NULL THEN
          v_kpi_value := (s.p->>v_payload_key)::numeric;
        END IF;

        -- Method 2: Stripped key lookup (preselected_kpi_N_<column> -> <column>)
        IF v_kpi_value IS NULL AND v_payload_key LIKE 'preselected_kpi_%' THEN
          v_stripped_key := regexp_replace(v_payload_key, '^preselected_kpi_\d+_', '');
          IF s.p->>v_stripped_key IS NOT NULL THEN
            v_kpi_value := (s.p->>v_stripped_key)::numeric;
          END IF;
        END IF;

        -- If we found a value, store it in custom_kpis under the custom KPI slug
        IF v_kpi_value IS NOT NULL THEN
          v_custom_kpis := v_custom_kpis || jsonb_build_object(v_selected_kpi_slug, v_kpi_value);
        END IF;
      END LOOP;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error extracting custom KPIs for submission %: %', p_submission, SQLERRM;
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
    quoted_count = EXCLUDED.quoted_count,
    quoted_entity = EXCLUDED.quoted_entity,
    sold_items = EXCLUDED.sold_items,
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

-- Revert the scorecard_rules back to using custom KPI slugs
-- (the SQL I gave earlier changed them to standard column names)
-- We need to restore the user's actual configuration
UPDATE scorecard_rules sr
SET
  ring_metrics = ARRAY['talk_minutes', 'custom_1769804996319', 'custom_1769804944768', 'outbound_calls'],
  selected_metrics = ARRAY['custom_1769804996319', 'outbound_calls', 'custom_1769804944768', 'talk_minutes']
WHERE sr.role = 'Service'
  AND EXISTS (
    SELECT 1 FROM kpis k
    WHERE k.agency_id = sr.agency_id
      AND k.key = 'custom_1769804996319'
  );

-- Reprocess recent submissions to populate custom_kpis correctly
DO $$
DECLARE
  sub_record RECORD;
BEGIN
  FOR sub_record IN
    SELECT s.id
    FROM submissions s
    JOIN form_templates ft ON ft.id = s.form_template_id
    WHERE s.final = true
      AND ft.status = 'published'
      AND s.submitted_at >= NOW() - INTERVAL '7 days'
    ORDER BY s.submitted_at DESC
  LOOP
    BEGIN
      PERFORM upsert_metrics_from_submission(sub_record.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to reprocess submission %: %', sub_record.id, SQLERRM;
    END;
  END LOOP;
END $$;
