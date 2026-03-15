-- Hybrid as a first-class scorecard role (Release 1: Configuration + Scoring)
--
-- 1. Seed scorecard_rules for Hybrid role for agencies with active Hybrid members
-- 2. Update create_default_scorecard_rules() to include Hybrid for new agencies
-- 3. Fix list_agency_kpis_by_role() so Hybrid shows all KPIs (Sales + Service + null-role)
--
-- SAFETY: The AFTER trigger recalculate_metrics_hits_pass() still resolves Hybrid scoring
-- based on the form template's role. No Hybrid form templates exist yet, so these seeded
-- rules are never used for scoring until an admin creates a Hybrid form. Zero behavior change.

-- =================================================================
-- 1. Seed Hybrid scorecard_rules for agencies with active Hybrid members
-- =================================================================
INSERT INTO scorecard_rules (agency_id, role, selected_metrics, weights, n_required)
SELECT DISTINCT tm.agency_id,
       'Hybrid'::app_member_role,
       ARRAY['outbound_calls', 'talk_minutes', 'quoted_households', 'items_sold'],
       '{"outbound_calls": 10, "talk_minutes": 20, "quoted_households": 30, "items_sold": 40}'::jsonb,
       2
FROM team_members tm
WHERE tm.role = 'Hybrid'
  AND tm.status = 'active'
ON CONFLICT (agency_id, role) DO NOTHING;

-- =================================================================
-- 2. Update create_default_scorecard_rules() to include Hybrid
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

  -- Hybrid default scorecard rules (mirrors Sales defaults — admins will customize)
  INSERT INTO scorecard_rules (agency_id, role, selected_metrics, weights, n_required)
  VALUES (
    p_agency_id,
    'Hybrid',
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
END;
$function$;

-- =================================================================
-- 3. Fix list_agency_kpis_by_role() — show all KPIs for Hybrid role
-- =================================================================
-- When _role = 'Hybrid', the role filter on kpis.role should not exclude
-- Sales-tagged or Service-tagged KPIs. Hybrid users need access to all KPIs.
CREATE OR REPLACE FUNCTION public.list_agency_kpis_by_role(_agency uuid, _role text DEFAULT NULL)
RETURNS TABLE(kpi_id uuid, slug text, label text, active boolean)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT DISTINCT k.id AS kpi_id, k.key AS slug, v.label, k.is_active AS active
  FROM kpis k
  JOIN kpi_versions v ON v.kpi_id = k.id
  WHERE k.agency_id = _agency
    AND v.valid_to IS NULL
    AND k.is_active = true
    -- Filter by role: Hybrid sees ALL KPIs (Sales + Service + null-role)
    AND (_role IS NULL OR k.role IS NULL OR k.role::text = _role OR _role = 'Hybrid')
    -- Filter by selected_metrics in scorecard_rules
    AND (_role IS NULL OR k.key = ANY(
      SELECT unnest(selected_metrics)
      FROM scorecard_rules
      WHERE agency_id = _agency AND role::text = _role
    ))
  ORDER BY v.label;
$$;
