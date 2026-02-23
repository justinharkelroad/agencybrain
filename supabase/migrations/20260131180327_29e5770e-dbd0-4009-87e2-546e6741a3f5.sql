-- Drop the broken auto_match_sale_to_lqs trigger from sales table
-- This trigger calls a function that expects NEW.sale_id, but sales table uses id
-- The matching logic on sale_policies table remains intact and functional

DO $$
BEGIN
  IF to_regclass('public.sales') IS NULL THEN
    RAISE NOTICE 'Skipping drop trigger migration: public.sales does not exist.';
    RETURN;
  END IF;

  DROP TRIGGER IF EXISTS auto_match_sale_to_lqs ON public.sales;
END;
$$;
