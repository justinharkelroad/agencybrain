-- Step 1: Create trigger function wrapper
CREATE OR REPLACE FUNCTION trigger_flatten_sold_details_enhanced()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process final submissions
  IF NEW.final = true THEN
    PERFORM flatten_sold_household_details_enhanced(NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Step 2: Create the trigger on submissions table
DROP TRIGGER IF EXISTS trigger_flatten_sold_details_enhanced ON public.submissions;
CREATE TRIGGER trigger_flatten_sold_details_enhanced
AFTER INSERT OR UPDATE OF final ON public.submissions
FOR EACH ROW
EXECUTE FUNCTION trigger_flatten_sold_details_enhanced();

-- Step 3: Backfill existing submissions with sold details that haven't been flattened
SELECT flatten_sold_household_details_enhanced(s.id)
FROM submissions s
WHERE s.final = true
AND jsonb_array_length(COALESCE(s.payload_json->'soldDetails', '[]'::jsonb)) > 0
AND NOT EXISTS (SELECT 1 FROM sold_policy_details spd WHERE spd.submission_id = s.id);