-- Fix ring_metrics sync to work in BOTH directions
-- Previously: only removed from ring_metrics when KPI disabled
-- Now: ring_metrics always equals selected_metrics (full sync)

-- Update the trigger to do full sync
CREATE OR REPLACE FUNCTION public.sync_ring_metrics_on_selected_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Full sync: ring_metrics should always equal selected_metrics
  -- This ensures the ring display shows all enabled KPIs
  IF OLD.selected_metrics IS DISTINCT FROM NEW.selected_metrics THEN
    RAISE NOTICE 'Syncing ring_metrics to match selected_metrics: %', NEW.selected_metrics;
    NEW.ring_metrics := NEW.selected_metrics;
  END IF;

  RETURN NEW;
END;
$$;

-- Also sync on INSERT
DROP TRIGGER IF EXISTS trg_sync_ring_metrics ON scorecard_rules;
CREATE TRIGGER trg_sync_ring_metrics
  BEFORE INSERT OR UPDATE ON scorecard_rules
  FOR EACH ROW
  EXECUTE FUNCTION sync_ring_metrics_on_selected_change();

-- Fix all existing rows: set ring_metrics = selected_metrics
UPDATE scorecard_rules
SET ring_metrics = selected_metrics
WHERE ring_metrics IS DISTINCT FROM selected_metrics
   OR ring_metrics IS NULL;

-- The validate_ring_metrics_subset trigger is now redundant but harmless
-- (ring_metrics will always equal selected_metrics)

COMMENT ON TRIGGER trg_sync_ring_metrics ON scorecard_rules IS 'Keeps ring_metrics in sync with selected_metrics - rings show all enabled KPIs';
