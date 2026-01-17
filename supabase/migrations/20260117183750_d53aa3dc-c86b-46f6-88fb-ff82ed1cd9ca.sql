-- Clean up orphaned metrics_daily rows where the submission has been deleted
DELETE FROM metrics_daily
WHERE final_submission_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM submissions s 
    WHERE s.team_member_id = metrics_daily.team_member_id 
      AND s.work_date = metrics_daily.date
  );

-- Create a trigger function to clean up metrics_daily when submissions are deleted
CREATE OR REPLACE FUNCTION public.cleanup_metrics_daily_on_submission_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- When a submission is deleted, check if there are any remaining submissions for that team_member + work_date
  IF NOT EXISTS (
    SELECT 1 FROM submissions 
    WHERE team_member_id = OLD.team_member_id 
      AND work_date = OLD.work_date
      AND id != OLD.id
  ) THEN
    -- No other submissions exist for this date, delete the metrics_daily row
    DELETE FROM metrics_daily 
    WHERE team_member_id = OLD.team_member_id 
      AND date = OLD.work_date;
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create the trigger on submissions table
DROP TRIGGER IF EXISTS trg_cleanup_metrics_daily_on_submission_delete ON submissions;
CREATE TRIGGER trg_cleanup_metrics_daily_on_submission_delete
  AFTER DELETE ON submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_metrics_daily_on_submission_delete();