-- DATA REPAIR: Reprocess Larry's submission and all December submissions
-- This runs the corrected upsert_metrics_from_submission function

DO $$
DECLARE
  sub_record record;
  processed_count int := 0;
  error_count int := 0;
BEGIN
  FOR sub_record IN
    SELECT s.id as submission_id
    FROM submissions s
    JOIN form_templates ft ON ft.id = s.form_template_id
    WHERE s.final = true
      AND coalesce(s.work_date, s.submission_date) >= '2025-12-01'
      AND ft.status = 'published'
  LOOP
    BEGIN
      PERFORM upsert_metrics_from_submission(sub_record.submission_id);
      processed_count := processed_count + 1;
    EXCEPTION WHEN OTHERS THEN
      error_count := error_count + 1;
      RAISE NOTICE 'Error processing submission %: %', sub_record.submission_id, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE 'Processed % submissions, % errors', processed_count, error_count;
END;
$$;