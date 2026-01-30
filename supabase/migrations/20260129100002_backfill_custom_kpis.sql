-- Backfill custom_kpis for existing submissions
-- Run this AFTER the function update is deployed

DO $$
DECLARE
  v_submission RECORD;
  v_count INT := 0;
  v_error_count INT := 0;
BEGIN
  RAISE NOTICE 'Starting custom_kpis backfill...';

  -- Find all final submissions that have custom KPIs in their form schema
  FOR v_submission IN
    SELECT DISTINCT s.id, s.work_date
    FROM submissions s
    JOIN form_templates ft ON ft.id = s.form_template_id
    WHERE s.final = true
    AND ft.schema_json->'kpis' IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(ft.schema_json->'kpis') elem
      WHERE elem->>'key' LIKE 'custom_kpi_%'
      AND elem->>'selectedKpiId' IS NOT NULL
    )
    ORDER BY s.work_date DESC
  LOOP
    BEGIN
      -- Re-run upsert to populate custom_kpis
      PERFORM upsert_metrics_from_submission(v_submission.id);
      v_count := v_count + 1;

      IF v_count % 100 = 0 THEN
        RAISE NOTICE 'Processed % submissions...', v_count;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_error_count := v_error_count + 1;
      RAISE WARNING 'Error processing submission %: %', v_submission.id, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE 'Backfill complete. Processed: %, Errors: %', v_count, v_error_count;
END $$;
