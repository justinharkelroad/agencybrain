-- Drop if exists (idempotent)
DO $$
BEGIN
  IF to_regclass('public.sale_policies') IS NULL THEN
    RAISE NOTICE 'Skipping sale policy auto-match trigger migration: public.sale_policies does not exist.';
    RETURN;
  END IF;

  IF to_regprocedure('public.trigger_auto_match_sale_to_lqs()') IS NULL THEN
    RAISE NOTICE 'Skipping sale policy auto-match trigger migration: public.trigger_auto_match_sale_to_lqs() does not exist.';
    RETURN;
  END IF;

  DROP TRIGGER IF EXISTS auto_match_sale_to_lqs_trigger ON public.sale_policies;

  -- Create trigger on sale_policies AFTER INSERT
  CREATE TRIGGER auto_match_sale_to_lqs_trigger
    AFTER INSERT ON public.sale_policies
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_auto_match_sale_to_lqs();
END;
$$;
