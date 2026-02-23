-- Add existing_customer_products column to sales table
-- This column stores which products the customer already owned when the sale was made
-- Used for correct bundle classification (e.g., 'auto', 'home')

DO $$
BEGIN
  IF to_regclass('public.sales') IS NULL THEN
    RAISE NOTICE 'Skipping migration 20260203110000_add_existing_customer_products: table public.sales does not exist.';
    RETURN;
  END IF;

  ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS existing_customer_products text[] DEFAULT '{}';

  COMMENT ON COLUMN public.sales.existing_customer_products IS
    'Products customer already owned when sale was made (auto, home). Used for bundle classification.';
END $$;
