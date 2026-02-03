-- Phase 1: Hard validation to prevent KPI reference drift
-- This migration adds:
-- 1. Function to check ALL KPI references (forms, ring_metrics, selected_metrics)
-- 2. Trigger to auto-sync ring_metrics when selected_metrics changes
-- 3. Enhanced delete check that includes ring_metrics

-- ============================================
-- 1. Comprehensive KPI reference check function
-- ============================================
CREATE OR REPLACE FUNCTION public.check_kpi_references(
  p_agency_id uuid,
  p_kpi_key text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
AS $$
DECLARE
  v_result jsonb;
  v_forms jsonb;
  v_ring_metrics boolean;
  v_selected_metrics boolean;
BEGIN
  -- Check active forms
  SELECT jsonb_agg(jsonb_build_object('id', ft.id, 'name', ft.name))
  INTO v_forms
  FROM public.form_templates ft
  WHERE ft.agency_id = p_agency_id
    AND ft.is_active = true
    AND (
      ft.schema_json::text ILIKE '%"selectedKpiSlug":"' || p_kpi_key || '"%'
      OR ft.schema_json::text ILIKE '%"key":"' || p_kpi_key || '"%'
    );

  -- Check ring_metrics
  SELECT EXISTS (
    SELECT 1
    FROM public.scorecard_rules sr
    WHERE sr.agency_id = p_agency_id
      AND p_kpi_key = ANY(sr.ring_metrics)
  ) INTO v_ring_metrics;

  -- Check selected_metrics
  SELECT EXISTS (
    SELECT 1
    FROM public.scorecard_rules sr
    WHERE sr.agency_id = p_agency_id
      AND p_kpi_key = ANY(sr.selected_metrics)
  ) INTO v_selected_metrics;

  v_result := jsonb_build_object(
    'kpi_key', p_kpi_key,
    'in_active_forms', COALESCE(v_forms, '[]'::jsonb),
    'in_ring_metrics', v_ring_metrics,
    'in_selected_metrics', v_selected_metrics,
    'can_delete', (v_forms IS NULL OR jsonb_array_length(v_forms) = 0) AND NOT v_ring_metrics,
    'can_disable', NOT v_ring_metrics
  );

  RETURN v_result;
END;
$$;

-- ============================================
-- 2. Update check_kpi_in_active_forms to also check ring_metrics
-- ============================================
-- Drop first because return type is changing (adding 'source' column)
DROP FUNCTION IF EXISTS public.check_kpi_in_active_forms(uuid, text);

CREATE OR REPLACE FUNCTION public.check_kpi_in_active_forms(
  p_agency_id uuid,
  p_kpi_key text
)
RETURNS TABLE(id uuid, name text, source text)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  -- Check active forms
  SELECT ft.id, ft.name, 'form'::text as source
  FROM public.form_templates ft
  WHERE ft.agency_id = p_agency_id
    AND ft.is_active = true
    AND (
      ft.schema_json::text ILIKE '%"selectedKpiSlug":"' || p_kpi_key || '"%'
      OR ft.schema_json::text ILIKE '%"key":"' || p_kpi_key || '"%'
    )

  UNION ALL

  -- Check ring_metrics (return a pseudo-entry for each role that uses it)
  SELECT
    sr.id,
    'Ring Display (' || sr.role::text || ')' as name,
    'ring_metrics'::text as source
  FROM public.scorecard_rules sr
  WHERE sr.agency_id = p_agency_id
    AND p_kpi_key = ANY(sr.ring_metrics);
$$;

-- ============================================
-- 3. Trigger function to auto-sync ring_metrics when selected_metrics changes
--    Ensures ring_metrics only contains KPIs that are in selected_metrics
-- ============================================
CREATE OR REPLACE FUNCTION public.sync_ring_metrics_on_selected_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_ring_metrics text[];
  v_removed text[];
BEGIN
  -- Only process if selected_metrics actually changed
  IF OLD.selected_metrics IS DISTINCT FROM NEW.selected_metrics THEN
    -- Filter ring_metrics to only include KPIs that are still in selected_metrics
    SELECT array_agg(rm)
    INTO v_new_ring_metrics
    FROM unnest(COALESCE(NEW.ring_metrics, ARRAY[]::text[])) rm
    WHERE rm = ANY(COALESCE(NEW.selected_metrics, ARRAY[]::text[]));

    -- Track what was removed for logging
    SELECT array_agg(rm)
    INTO v_removed
    FROM unnest(COALESCE(OLD.ring_metrics, ARRAY[]::text[])) rm
    WHERE rm = ANY(COALESCE(OLD.selected_metrics, ARRAY[]::text[]))
      AND NOT (rm = ANY(COALESCE(NEW.selected_metrics, ARRAY[]::text[])));

    -- Update ring_metrics if anything was removed
    IF v_removed IS NOT NULL AND array_length(v_removed, 1) > 0 THEN
      RAISE NOTICE 'Auto-removing disabled KPIs from ring_metrics: %', v_removed;
      NEW.ring_metrics := COALESCE(v_new_ring_metrics, ARRAY[]::text[]);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS trg_sync_ring_metrics ON scorecard_rules;
CREATE TRIGGER trg_sync_ring_metrics
  BEFORE UPDATE ON scorecard_rules
  FOR EACH ROW
  EXECUTE FUNCTION sync_ring_metrics_on_selected_change();

-- ============================================
-- 4. Function to validate KPI can be deleted (used by delete_kpi edge function)
-- ============================================
CREATE OR REPLACE FUNCTION public.validate_kpi_deletion(
  p_agency_id uuid,
  p_kpi_key text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
AS $$
DECLARE
  v_blockers jsonb := '[]'::jsonb;
  v_form record;
  v_rule record;
BEGIN
  -- Check active forms
  FOR v_form IN
    SELECT ft.id, ft.name
    FROM public.form_templates ft
    WHERE ft.agency_id = p_agency_id
      AND ft.is_active = true
      AND (
        ft.schema_json::text ILIKE '%"selectedKpiSlug":"' || p_kpi_key || '"%'
        OR ft.schema_json::text ILIKE '%"key":"' || p_kpi_key || '"%'
      )
  LOOP
    v_blockers := v_blockers || jsonb_build_object(
      'type', 'form',
      'id', v_form.id,
      'name', v_form.name,
      'message', 'KPI is used in active form: ' || v_form.name
    );
  END LOOP;

  -- Check ring_metrics
  FOR v_rule IN
    SELECT sr.id, sr.role
    FROM public.scorecard_rules sr
    WHERE sr.agency_id = p_agency_id
      AND p_kpi_key = ANY(sr.ring_metrics)
  LOOP
    v_blockers := v_blockers || jsonb_build_object(
      'type', 'ring_metrics',
      'id', v_rule.id,
      'role', v_rule.role,
      'message', 'KPI is displayed in ' || v_rule.role || ' ring metrics. Disable it first.'
    );
  END LOOP;

  RETURN jsonb_build_object(
    'can_delete', jsonb_array_length(v_blockers) = 0,
    'blockers', v_blockers
  );
END;
$$;

-- ============================================
-- 5. One-time fix: Clean up any existing orphaned ring_metrics
--    (ring_metrics entries that aren't in selected_metrics)
-- ============================================
UPDATE scorecard_rules sr
SET ring_metrics = (
  SELECT array_agg(rm)
  FROM unnest(sr.ring_metrics) rm
  WHERE rm = ANY(sr.selected_metrics)
)
WHERE EXISTS (
  SELECT 1
  FROM unnest(sr.ring_metrics) rm
  WHERE NOT (rm = ANY(sr.selected_metrics))
);

-- Log what was cleaned
DO $$
DECLARE
  v_count int;
BEGIN
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN
    RAISE NOTICE 'Cleaned up orphaned ring_metrics in % scorecard_rules rows', v_count;
  END IF;
END $$;

-- ============================================
-- 6. Trigger to validate ring_metrics is subset of selected_metrics on ANY update
--    Prevents saving ring_metrics with KPIs not in selected_metrics
-- ============================================
CREATE OR REPLACE FUNCTION public.validate_ring_metrics_subset()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invalid text[];
BEGIN
  -- Check if any ring_metrics entries are NOT in selected_metrics
  IF NEW.ring_metrics IS NOT NULL AND array_length(NEW.ring_metrics, 1) > 0 THEN
    SELECT array_agg(rm)
    INTO v_invalid
    FROM unnest(NEW.ring_metrics) rm
    WHERE NOT (rm = ANY(COALESCE(NEW.selected_metrics, ARRAY[]::text[])));

    IF v_invalid IS NOT NULL AND array_length(v_invalid, 1) > 0 THEN
      -- Auto-fix: remove invalid entries instead of failing
      RAISE NOTICE 'Removing invalid ring_metrics entries (not in selected_metrics): %', v_invalid;
      NEW.ring_metrics := (
        SELECT array_agg(rm)
        FROM unnest(NEW.ring_metrics) rm
        WHERE rm = ANY(COALESCE(NEW.selected_metrics, ARRAY[]::text[]))
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create the trigger (runs AFTER sync_ring_metrics to catch direct ring_metrics updates)
DROP TRIGGER IF EXISTS trg_validate_ring_metrics ON scorecard_rules;
CREATE TRIGGER trg_validate_ring_metrics
  BEFORE INSERT OR UPDATE ON scorecard_rules
  FOR EACH ROW
  EXECUTE FUNCTION validate_ring_metrics_subset();

COMMENT ON FUNCTION public.check_kpi_references IS 'Returns comprehensive info about where a KPI is referenced (forms, ring_metrics, selected_metrics)';
COMMENT ON FUNCTION public.validate_kpi_deletion IS 'Validates if a KPI can be deleted, returns blockers if not';
COMMENT ON TRIGGER trg_sync_ring_metrics ON scorecard_rules IS 'Auto-removes KPIs from ring_metrics when they are removed from selected_metrics';
COMMENT ON TRIGGER trg_validate_ring_metrics ON scorecard_rules IS 'Ensures ring_metrics only contains KPIs from selected_metrics';
