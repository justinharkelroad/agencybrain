-- Attach the auto-match trigger to the sales table
-- This will automatically link new sales to LQS households on insert

DO $$
BEGIN
  IF to_regclass('public.sales') IS NULL THEN
    RAISE NOTICE 'Skipping auto-match trigger migration: public.sales does not exist.';
    RETURN;
  END IF;

  IF to_regprocedure('public.trigger_auto_match_sale_to_lqs()') IS NULL THEN
    RAISE NOTICE 'Skipping auto-match trigger migration: public.trigger_auto_match_sale_to_lqs() does not exist.';
    RETURN;
  END IF;

  DROP TRIGGER IF EXISTS auto_match_sale_to_lqs ON public.sales;

  CREATE TRIGGER auto_match_sale_to_lqs
  AFTER INSERT ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_auto_match_sale_to_lqs();
END;
$$;
