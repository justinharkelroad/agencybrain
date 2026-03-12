DO $$
BEGIN
  IF to_regclass('public.sales') IS NOT NULL
     AND to_regclass('public.brokered_carriers') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conname = 'sales_brokered_carrier_id_fkey'
         AND conrelid = 'public.sales'::regclass
     ) THEN
    ALTER TABLE public.sales
      ADD CONSTRAINT sales_brokered_carrier_id_fkey
      FOREIGN KEY (brokered_carrier_id) REFERENCES public.brokered_carriers(id) ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.sales') IS NOT NULL
     AND to_regclass('public.prior_insurance_companies') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conname = 'sales_prior_insurance_company_id_fkey'
         AND conrelid = 'public.sales'::regclass
     ) THEN
    ALTER TABLE public.sales
      ADD CONSTRAINT sales_prior_insurance_company_id_fkey
      FOREIGN KEY (prior_insurance_company_id) REFERENCES public.prior_insurance_companies(id) ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.sale_policies') IS NOT NULL
     AND to_regclass('public.brokered_carriers') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conname = 'sale_policies_brokered_carrier_id_fkey'
         AND conrelid = 'public.sale_policies'::regclass
     ) THEN
    ALTER TABLE public.sale_policies
      ADD CONSTRAINT sale_policies_brokered_carrier_id_fkey
      FOREIGN KEY (brokered_carrier_id) REFERENCES public.brokered_carriers(id) ON DELETE SET NULL;
  END IF;
END
$$;
