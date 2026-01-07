-- Attach the auto-match trigger to the sales table
-- This will automatically link new sales to LQS households on insert

DROP TRIGGER IF EXISTS auto_match_sale_to_lqs ON sales;

CREATE TRIGGER auto_match_sale_to_lqs
AFTER INSERT ON sales
FOR EACH ROW
EXECUTE FUNCTION trigger_auto_match_sale_to_lqs();