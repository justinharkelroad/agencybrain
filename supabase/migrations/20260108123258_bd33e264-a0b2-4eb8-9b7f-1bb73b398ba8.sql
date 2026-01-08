-- Drop if exists (idempotent)
DROP TRIGGER IF EXISTS auto_match_sale_to_lqs_trigger ON sale_policies;

-- Create trigger on sale_policies AFTER INSERT
CREATE TRIGGER auto_match_sale_to_lqs_trigger
  AFTER INSERT ON sale_policies
  FOR EACH ROW
  EXECUTE FUNCTION trigger_auto_match_sale_to_lqs();