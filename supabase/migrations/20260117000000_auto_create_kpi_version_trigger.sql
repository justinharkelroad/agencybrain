-- Migration: Auto-create KPI version on KPI creation
-- This ensures every KPI always has at least one active version

CREATE OR REPLACE FUNCTION public.auto_create_kpi_version()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if version already exists
  IF NOT EXISTS (SELECT 1 FROM kpi_versions WHERE kpi_id = NEW.id) THEN
    INSERT INTO kpi_versions (kpi_id, label, valid_from)
    VALUES (NEW.id, NEW.label, now());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop if exists to make migration idempotent
DROP TRIGGER IF EXISTS trg_auto_kpi_version ON kpis;

CREATE TRIGGER trg_auto_kpi_version
AFTER INSERT ON kpis
FOR EACH ROW EXECUTE FUNCTION public.auto_create_kpi_version();
