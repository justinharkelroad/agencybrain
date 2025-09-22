-- Create/update view for metrics with proper team member names
CREATE OR REPLACE VIEW public.vw_metrics_with_team AS
SELECT md.*,
       COALESCE(tm.name, CONCAT(tm.first_name, ' ', tm.last_name), 'Unassigned') AS rep_name,
       md.quoted_entity
FROM public.metrics_daily md
LEFT JOIN public.team_members tm
  ON tm.id = md.team_member_id
 AND tm.agency_id = md.agency_id;

-- Update submission trigger to use enhanced flattener
-- First, drop old trigger if exists
DROP TRIGGER IF EXISTS trigger_flatten_quoted_details ON public.submissions;

-- Create new trigger that calls enhanced function
CREATE OR REPLACE FUNCTION public.trigger_flatten_quoted_details_enhanced()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only process final submissions and ensure idempotence
  IF NEW.final = true THEN
    -- Call enhanced flattener instead of legacy one
    PERFORM flatten_quoted_household_details_enhanced(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger on submissions table
CREATE TRIGGER trigger_flatten_quoted_details_enhanced
  AFTER INSERT OR UPDATE OF final ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_flatten_quoted_details_enhanced();