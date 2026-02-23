-- Add per-policy brokered carrier support
-- This allows each policy within a sale to independently be brokered or not

DO $$
BEGIN
  IF to_regclass('public.sale_policies') IS NULL THEN
    RAISE NOTICE 'Skipping migration 20260202120000_add_brokered_carrier_to_sale_policies: table public.sale_policies does not exist.';
    RETURN;
  END IF;

  IF to_regclass('public.brokered_carriers') IS NULL THEN
    RAISE NOTICE 'Skipping migration 20260202120000_add_brokered_carrier_to_sale_policies: table public.brokered_carriers does not exist.';
    RETURN;
  END IF;

  -- Add brokered_carrier_id column to sale_policies
  ALTER TABLE public.sale_policies
    ADD COLUMN IF NOT EXISTS brokered_carrier_id uuid REFERENCES public.brokered_carriers(id);

  -- Create index for efficient filtering by brokered policies
  CREATE INDEX IF NOT EXISTS idx_sale_policies_brokered_carrier
    ON public.sale_policies(brokered_carrier_id) WHERE brokered_carrier_id IS NOT NULL;

  -- Add comment for documentation
  COMMENT ON COLUMN public.sale_policies.brokered_carrier_id IS 'Reference to brokered carrier for this policy. If set, indicates this policy is through a non-captive carrier.';
END $$;
