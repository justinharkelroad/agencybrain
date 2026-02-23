-- Add Prior Insurance Companies table
-- Tracks where customers had insurance before switching to this agency

-- ============================================
-- 1. prior_insurance_companies - New Table
-- ============================================
DO $$
BEGIN
  IF to_regclass('public.agencies') IS NULL THEN
    RAISE NOTICE 'Skipping 20260205120000_add_prior_insurance_companies: table public.agencies does not exist.';
    RETURN;
  END IF;

  CREATE TABLE IF NOT EXISTS public.prior_insurance_companies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    name text NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(agency_id, name)
  );

  COMMENT ON TABLE public.prior_insurance_companies IS 'Insurance companies that customers had before switching to this agency.';

  -- Create indexes for agency lookups
  CREATE INDEX IF NOT EXISTS idx_prior_insurance_companies_agency_id
    ON public.prior_insurance_companies(agency_id);
  CREATE INDEX IF NOT EXISTS idx_prior_insurance_companies_active
    ON public.prior_insurance_companies(agency_id, is_active) WHERE is_active = true;

  -- Enable RLS
  ALTER TABLE public.prior_insurance_companies ENABLE ROW LEVEL SECURITY;

  -- RLS policies
  CREATE POLICY "Users can view their agency prior insurance companies"
    ON public.prior_insurance_companies FOR SELECT
    USING (public.has_agency_access(auth.uid(), agency_id));

  CREATE POLICY "Users can insert their agency prior insurance companies"
    ON public.prior_insurance_companies FOR INSERT
    WITH CHECK (public.has_agency_access(auth.uid(), agency_id));

  CREATE POLICY "Users can update their agency prior insurance companies"
    ON public.prior_insurance_companies FOR UPDATE
    USING (public.has_agency_access(auth.uid(), agency_id));

  CREATE POLICY "Users can delete their agency prior insurance companies"
    ON public.prior_insurance_companies FOR DELETE
    USING (public.has_agency_access(auth.uid(), agency_id));

  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'update_updated_at_column'
      AND n.nspname = 'public'
  ) THEN
    -- Updated_at trigger
    CREATE TRIGGER update_prior_insurance_companies_updated_at
      BEFORE UPDATE ON public.prior_insurance_companies
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  ELSE
    RAISE NOTICE 'Skipping prior_insurance_companies updated_at trigger: public.update_updated_at_column does not exist.';
  END IF;
END $$;

-- ============================================
-- 2. sales - Prior Insurance Company Reference
-- ============================================
DO $$
BEGIN
  IF to_regclass('public.sales') IS NULL THEN
    RAISE NOTICE 'Skipping 20260205120000_add_prior_insurance_companies (sales reference): table public.sales does not exist.';
    RETURN;
  END IF;

  ALTER TABLE public.sales
    ADD COLUMN IF NOT EXISTS prior_insurance_company_id uuid REFERENCES public.prior_insurance_companies(id);

  CREATE INDEX IF NOT EXISTS idx_sales_prior_insurance_company
    ON public.sales(prior_insurance_company_id)
    WHERE prior_insurance_company_id IS NOT NULL;

  COMMENT ON COLUMN public.sales.prior_insurance_company_id IS 'The insurance company the customer had before this sale.';
END $$;
