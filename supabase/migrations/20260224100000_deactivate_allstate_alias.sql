-- Deactivate the Allstate alias carrier schema record that causes a duplicate
-- dropdown entry in the Growth Intelligence Center.
--
-- The alias (schema_key='allstate') was created for CLI testing in the original
-- growth center migration. Both records appear as active in the carrier dropdown.
-- This migration reassigns any existing references to the primary record and
-- deactivates the alias.

DO $$
DECLARE
  v_primary_id uuid;
  v_alias_id   uuid;
BEGIN
  SELECT id INTO v_primary_id
  FROM public.carrier_schemas
  WHERE schema_key = 'allstate_bm';

  SELECT id INTO v_alias_id
  FROM public.carrier_schemas
  WHERE schema_key = 'allstate';

  -- Nothing to do if alias doesn't exist
  IF v_alias_id IS NULL THEN
    RETURN;
  END IF;

  -- Reassign reports pointing to the alias → primary.
  -- Snapshots link to reports via report_id (no carrier_schema_id column),
  -- so they follow transitively and need no update.
  --
  -- The table has UNIQUE(agency_id, carrier_schema_id, report_month).
  -- If an agency already has a report under the primary for the same month,
  -- delete the alias duplicate (keeping the primary's report) to avoid
  -- a unique-constraint violation.
  IF v_primary_id IS NOT NULL THEN
    -- First, delete alias reports that would conflict with existing primary reports
    DELETE FROM public.business_metrics_reports alias_r
    WHERE alias_r.carrier_schema_id = v_alias_id
      AND EXISTS (
        SELECT 1 FROM public.business_metrics_reports primary_r
        WHERE primary_r.carrier_schema_id = v_primary_id
          AND primary_r.agency_id = alias_r.agency_id
          AND primary_r.report_month = alias_r.report_month
      );

    -- Then reassign remaining alias reports to the primary
    UPDATE public.business_metrics_reports
    SET carrier_schema_id = v_primary_id
    WHERE carrier_schema_id = v_alias_id;
  END IF;

  -- Deactivate the alias record
  UPDATE public.carrier_schemas
  SET is_active = false, updated_at = now()
  WHERE id = v_alias_id;
END $$;
