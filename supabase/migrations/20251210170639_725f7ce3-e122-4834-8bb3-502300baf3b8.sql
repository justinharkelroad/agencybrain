-- COMPREHENSIVE KPI KEY STANDARDIZATION FIX
-- Fixes all database functions to use standardized keys: items_sold, quoted_households
-- Also repairs existing data affected by the key mismatch bug

-- =================================================================
-- 1. FIX create_default_scorecard_rules - use new keys
-- =================================================================
CREATE OR REPLACE FUNCTION public.create_default_scorecard_rules(p_agency_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Sales default scorecard rules
  INSERT INTO scorecard_rules (agency_id, role, selected_metrics, weights, n_required)
  VALUES (
    p_agency_id, 
    'Sales',
    ARRAY['outbound_calls', 'talk_minutes', 'quoted_households', 'items_sold'],
    '{
      "outbound_calls": 10,
      "talk_minutes": 20, 
      "quoted_households": 30,
      "items_sold": 40
    }'::jsonb,
    2
  )
  ON CONFLICT (agency_id, role) DO NOTHING;

  -- Service default scorecard rules  
  INSERT INTO scorecard_rules (agency_id, role, selected_metrics, weights, n_required)
  VALUES (
    p_agency_id,
    'Service', 
    ARRAY['outbound_calls', 'talk_minutes', 'cross_sells_uncovered', 'mini_reviews'],
    '{
      "outbound_calls": 25,
      "talk_minutes": 25,
      "cross_sells_uncovered": 25, 
      "mini_reviews": 25
    }'::jsonb,
    2
  )
  ON CONFLICT (agency_id, role) DO NOTHING;
END;
$function$;

-- =================================================================
-- 2. FIX create_default_targets - use new keys
-- =================================================================
CREATE OR REPLACE FUNCTION public.create_default_targets(p_agency_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Sales default targets (using standardized keys)
  INSERT INTO targets (agency_id, metric_key, value_number)
  VALUES 
    (p_agency_id, 'outbound_calls', 100),
    (p_agency_id, 'talk_minutes', 180), 
    (p_agency_id, 'quoted_households', 5),
    (p_agency_id, 'items_sold', 2),
    (p_agency_id, 'sold_policies', 2),
    (p_agency_id, 'sold_premium', 1000)
  ON CONFLICT (agency_id, metric_key, team_member_id) DO NOTHING;

  -- Service default targets
  INSERT INTO targets (agency_id, metric_key, value_number)
  VALUES
    (p_agency_id, 'outbound_calls', 30),
    (p_agency_id, 'talk_minutes', 180),
    (p_agency_id, 'cross_sells_uncovered', 2), 
    (p_agency_id, 'mini_reviews', 5)
  ON CONFLICT (agency_id, metric_key, team_member_id) DO NOTHING;
END;
$function$;

-- =================================================================
-- 3. FIX upsert_metrics_from_submission - use new keys for weight lookup, 
--    metric selection checks, and target lookups
-- =================================================================
CREATE OR REPLACE FUNCTION public.upsert_metrics_from_submission(
  p_submission uuid,
  p_kpi_version_id uuid DEFAULT NULL,
  p_label_at_submit text DEFAULT NULL,
  p_submitted_at timestamp with time zone DEFAULT NULL
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

  IF v_kpi_version_id IS NULL OR v_label_at_submit IS NULL THEN
    RAISE EXCEPTION 'missing_kpi_binding: Cannot insert metrics without valid KPI version and label';
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

  oc := _nz_int(s.p->'outbound_calls');
  tm := _nz_int(s.p->'talk_minutes');
  qc := _nz_int(s.p->'quoted_count');
  qe := nullif(coalesce(s.p->>'quoted_entity',''), '');
  si := _nz_int(s.p->'sold_items');
  so := _nz_int(s.p->'sold_policies');
  
  BEGIN
    sp := floor(_nz_num(s.p->'sold_premium')*100)::int;
  EXCEPTION WHEN OTHERS THEN
    sp := 0;
  END;
  sp_cents := sp;

  csu := _nz_int(s.p->'cross_sells_uncovered');
  mr := _nz_int(s.p->'mini_reviews');

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

  -- FIXED: Use standardized keys (quoted_households, items_sold)
  tmap := coalesce(rules.weights, '{}'::jsonb);
  w_out := coalesce((tmap->>'outbound_calls')::int, 0);
  w_talk := coalesce((tmap->>'talk_minutes')::int, 0);
  w_quoted := coalesce((tmap->>'quoted_households')::int, 0);
  w_items := coalesce((tmap->>'items_sold')::int, 0);
  w_pols := coalesce((tmap->>'sold_policies')::int, 0);
  w_prem := coalesce((tmap->>'sold_premium')::int, 0);
  w_csu := coalesce((tmap->>'cross_sells_uncovered')::int, 0);
  w_mr := coalesce((tmap->>'mini_reviews')::int, 0);

  -- FIXED: Use standardized keys in default fallback
  sel := coalesce(rules.selected_metrics, ARRAY['outbound_calls','talk_minutes','quoted_households','items_sold']);
  nreq := rules.n_required;

  hits := 0; 
  score := 0;

  IF 'outbound_calls' = ANY(sel) THEN
    IF oc >= get_target(s.agency_id, s.tm_id, 'outbound_calls') THEN 
      hits := hits + 1;
      score := score + w_out;
    END IF;
  END IF;

  IF 'talk_minutes' = ANY(sel) THEN
    IF tm >= get_target(s.agency_id, s.tm_id, 'talk_minutes') THEN 
      hits := hits + 1;
      score := score + w_talk;
    END IF;
  END IF;

  -- FIXED: Use standardized keys for quoted_households
  IF 'quoted_households' = ANY(sel) THEN
    IF qc >= get_target(s.agency_id, s.tm_id, 'quoted_households') THEN 
      hits := hits + 1;
      score := score + w_quoted;
    END IF;
  END IF;

  -- FIXED: Use standardized keys for items_sold
  IF 'items_sold' = ANY(sel) THEN
    IF si >= get_target(s.agency_id, s.tm_id, 'items_sold') THEN 
      hits := hits + 1;
      score := score + w_items;
    END IF;
  END IF;

  IF 'sold_policies' = ANY(sel) THEN
    IF so >= get_target(s.agency_id, s.tm_id, 'sold_policies') THEN 
      hits := hits + 1;
      score := score + w_pols;
    END IF;
  END IF;

  IF 'sold_premium' = ANY(sel) THEN
    IF sp_cents >= (get_target(s.agency_id, s.tm_id, 'sold_premium')*100)::int THEN 
      hits := hits + 1;
      score := score + w_prem;
    END IF;
  END IF;

  IF 'cross_sells_uncovered' = ANY(sel) THEN
    IF csu >= get_target(s.agency_id, s.tm_id, 'cross_sells_uncovered') THEN 
      hits := hits + 1;
      score := score + w_csu;
    END IF;
  END IF;

  IF 'mini_reviews' = ANY(sel) THEN
    IF mr >= get_target(s.agency_id, s.tm_id, 'mini_reviews') THEN 
      hits := hits + 1;
      score := score + w_mr;
    END IF;
  END IF;

  pass := (hits >= nreq);

  IF late = true AND allow_late = false THEN
    pass := false;
    score := 0;
  END IF;

  INSERT INTO metrics_daily (
    agency_id, team_member_id, role, date,
    outbound_calls, talk_minutes, quoted_count, quoted_entity,
    sold_items, sold_policies, sold_premium_cents,
    cross_sells_uncovered, mini_reviews,
    pass, hits, daily_score, is_late, is_counted_day, final_submission_id,
    kpi_version_id, label_at_submit, submitted_at,
    updated_at
  )
  VALUES (
    s.agency_id, s.tm_id, role_txt, the_date,
    oc, tm, qc, qe,
    si, so, sp_cents,
    csu, mr,
    pass, hits, score, late, flag, s.submission_id,
    v_kpi_version_id, v_label_at_submit, coalesce(p_submitted_at, now()),
    now()
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
    kpi_version_id = EXCLUDED.kpi_version_id,
    label_at_submit = EXCLUDED.label_at_submit,
    submitted_at = EXCLUDED.submitted_at,
    updated_at = now();
END;
$function$;

-- =================================================================
-- 4. NORMALIZE TARGETS TABLE - standardize metric_key values
-- =================================================================
UPDATE targets
SET metric_key = 'items_sold'
WHERE metric_key = 'sold_items';

UPDATE targets
SET metric_key = 'quoted_households'
WHERE metric_key = 'quoted_count';

-- =================================================================
-- 5. DATA REPAIR: Reprocess all affected submissions from December
-- =================================================================
DO $$
DECLARE
  sub_record record;
BEGIN
  FOR sub_record IN
    SELECT s.id as submission_id, coalesce(s.work_date, s.submission_date) as work_dt
    FROM submissions s
    JOIN form_templates ft ON ft.id = s.form_template_id
    WHERE s.final = true
      AND coalesce(s.work_date, s.submission_date) >= '2025-12-01'
      AND ft.status = 'published'
    ORDER BY work_dt DESC
  LOOP
    BEGIN
      PERFORM upsert_metrics_from_submission(sub_record.submission_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipping submission % due to error: %', sub_record.submission_id, SQLERRM;
    END;
  END LOOP;
END;
$$;