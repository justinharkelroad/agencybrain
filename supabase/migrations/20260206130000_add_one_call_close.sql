-- Add is_one_call_close boolean to sales and lqs_sales tables
-- Forward-looking only: all existing rows default to false, no backfill
DO $$
BEGIN
  IF to_regclass('public.sales') IS NOT NULL THEN
    ALTER TABLE public.sales
      ADD COLUMN IF NOT EXISTS is_one_call_close boolean NOT NULL DEFAULT false;
  END IF;

  IF to_regclass('public.lqs_sales') IS NOT NULL THEN
    ALTER TABLE public.lqs_sales
      ADD COLUMN IF NOT EXISTS is_one_call_close boolean NOT NULL DEFAULT false;
  END IF;
END $$;
