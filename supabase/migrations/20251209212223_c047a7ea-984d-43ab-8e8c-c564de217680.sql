
-- Create function to seed default KPIs for an agency
CREATE OR REPLACE FUNCTION public.create_default_kpis(p_agency_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  kpi_def record;
  new_kpi_id uuid;
  kpi_role app_member_role;
BEGIN
  FOR kpi_def IN 
    SELECT * FROM kpi_definitions WHERE is_active = true ORDER BY sort_order
  LOOP
    -- Skip if this KPI already exists for this agency
    IF NOT EXISTS (
      SELECT 1 FROM kpis 
      WHERE agency_id = p_agency_id AND key = kpi_def.slug
    ) THEN
      -- Determine role: if only Sales -> 'Sales', only Service -> 'Service', both -> NULL (Hybrid)
      IF array_length(kpi_def.applicable_roles, 1) = 1 THEN
        kpi_role := kpi_def.applicable_roles[1]::app_member_role;
      ELSE
        -- Applies to multiple roles, set as NULL (works for both)
        kpi_role := NULL;
      END IF;
      
      -- Insert the KPI
      INSERT INTO kpis (agency_id, key, label, type, role, kpi_definition_id, is_active)
      VALUES (p_agency_id, kpi_def.slug, kpi_def.label, kpi_def.type, kpi_role, kpi_def.id, true)
      RETURNING id INTO new_kpi_id;
      
      -- Create initial version entry for label tracking
      INSERT INTO kpi_versions (kpi_id, label, valid_from)
      VALUES (new_kpi_id, kpi_def.label, now());
    END IF;
  END LOOP;
END;
$$;

-- Update setup_new_agency_defaults to call create_default_kpis FIRST
CREATE OR REPLACE FUNCTION public.setup_new_agency_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Setup default KPIs FIRST (scorecard rules may reference these)
  PERFORM create_default_kpis(NEW.id);
  
  -- Then setup scorecard rules
  PERFORM create_default_scorecard_rules(NEW.id);
  
  -- Then setup targets
  PERFORM create_default_targets(NEW.id);
  
  RETURN NEW;
END;
$$;

-- Backfill existing agencies with missing KPIs
DO $$
DECLARE
  agency_record record;
BEGIN
  FOR agency_record IN SELECT id FROM agencies LOOP
    PERFORM create_default_kpis(agency_record.id);
  END LOOP;
END;
$$;
