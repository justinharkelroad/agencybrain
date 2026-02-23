-- Add support for counting brokered policies toward bundling metrics
-- This helps agencies where the captive carrier doesn't write certain products in their state

DO $$
BEGIN
  IF to_regclass('public.sales') IS NULL THEN
    RAISE NOTICE 'Skipping migration 20260202130000_add_brokered_bundling_support: table public.sales does not exist.';
    RETURN;
  END IF;

  IF to_regclass('public.comp_plans') IS NULL THEN
    RAISE NOTICE 'Skipping migration 20260202130000_add_brokered_bundling_support: table public.comp_plans does not exist.';
    RETURN;
  END IF;

  -- Flag on sales to indicate brokered policy should count toward bundling
  ALTER TABLE public.sales
    ADD COLUMN IF NOT EXISTS brokered_counts_toward_bundling boolean DEFAULT false;

  COMMENT ON COLUMN public.sales.brokered_counts_toward_bundling IS
    'When true, brokered policies in this sale count toward bundling metrics (households, percentage).';

  -- Setting on comp_plans to enable this feature
  ALTER TABLE public.comp_plans
    ADD COLUMN IF NOT EXISTS include_brokered_in_bundling boolean DEFAULT false;

  COMMENT ON COLUMN public.comp_plans.include_brokered_in_bundling IS
    'When true, sales with brokered_counts_toward_bundling=true are included in bundling calculations.';
END $$;
