-- BLOCKER: Update upsert_metrics_from_submission to prevent NULL constraint violations
-- This fixes the md_version_fields_nonnull constraint violation by ensuring
-- kpi_version_id and label_at_submit are never NULL when inserting metrics

CREATE OR REPLACE FUNCTION public.upsert_metrics_from_submission(
  p_submission uuid,
  p_kpi_version_id uuid DEFAULT NULL,
  p_label_at_submit text DEFAULT NULL,
  p_submitted_at timestamptz DEFAULT NULL
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
  -- KPI version resolution
  v_kpi_version_id uuid;
  v_label_at_submit text;
BEGIN
  -- Load submission + template + agency + team role
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

  -- Resolve KPI version if params are NULL
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

  -- Final guard: do NOT write if still NULL (constraint violation prevention)
  IF v_kpi_version_id IS NULL OR v_label_at_submit IS NULL THEN
    RAISE EXCEPTION 'missing_kpi_binding: Cannot insert metrics without valid KPI version and label';
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

  -- extract KPIs from payload (Sales) - with safe numeric conversion
  oc := _nz_int(s.p->'outbound_calls');
  tm := _nz_int(s.p->'talk_minutes');
  qc := _nz_int(s.p->'quoted_count');
  qe := nullif(coalesce(s.p->>'quoted_entity',''), '');
  si := _nz_int(s.p->'sold_items');
  so := _nz_int(s.p->'sold_policies');
  
  -- Handle sold_premium more safely
  BEGIN
    sp := floor(_nz_num(s.p->'sold_premium')*100)::int;
  EXCEPTION WHEN OTHERS THEN
    sp := 0;
  END;
  sp_cents := sp;

  -- Service KPIs
  csu := _nz_int(s.p->'cross_sells_uncovered');
  mr := _nz_int(s.p->'mini_reviews');

  -- determine if this day is counted
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

  -- compute hits (>= target) and score (weight if >= target)
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

  IF 'quoted_count' = ANY(sel) THEN
    IF qc >= get_target(s.agency_id, s.tm_id, 'quoted_count') THEN 
      hits := hits + 1;
      score := score + w_quoted;
    END IF;
  END IF;

  IF 'sold_items' = ANY(sel) THEN
    IF si >= get_target(s.agency_id, s.tm_id, 'sold_items') THEN 
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

  -- late policy
  IF late = true AND allow_late = false THEN
    pass := false;
    score := 0;
  END IF;

  -- upsert metrics_daily with validated KPI version fields (never NULL)
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