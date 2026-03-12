-- Baseline recovery for missing sales dashboard schema.
-- Some environments already have these tables, so keep every operation idempotent.

CREATE TABLE IF NOT EXISTS public.product_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL,
  default_points numeric NULL DEFAULT 0,
  is_vc_item boolean NULL DEFAULT false,
  is_active boolean NULL DEFAULT true,
  exclude_from_item_count boolean NULL DEFAULT false,
  exclude_from_policy_count boolean NULL DEFAULT false,
  created_at timestamptz NULL DEFAULT now(),
  updated_at timestamptz NULL DEFAULT now()
);

ALTER TABLE public.product_types
  ADD COLUMN IF NOT EXISTS agency_id uuid NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS default_points numeric NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_vc_item boolean NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_active boolean NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS exclude_from_item_count boolean NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS exclude_from_policy_count boolean NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NULL DEFAULT now();

ALTER TABLE public.product_types ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_types_global_name_unique
  ON public.product_types (lower(name))
  WHERE agency_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_types_agency_name_unique
  ON public.product_types (agency_id, lower(name))
  WHERE agency_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_product_types_active
  ON public.product_types (is_active);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'product_types'
      AND policyname = 'Users can view product types'
  ) THEN
    CREATE POLICY "Users can view product types"
      ON public.product_types
      FOR SELECT
      USING (agency_id IS NULL OR has_agency_access(auth.uid(), agency_id));
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regprocedure('public.update_updated_at_column()') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS update_product_types_updated_at ON public.product_types;
    CREATE TRIGGER update_product_types_updated_at
      BEFORE UPDATE ON public.product_types
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END
$$;

INSERT INTO public.product_types (
  name,
  category,
  default_points,
  is_vc_item,
  is_active,
  exclude_from_item_count,
  exclude_from_policy_count,
  agency_id
)
SELECT
  seed.name,
  seed.category,
  seed.default_points,
  seed.is_vc_item,
  true,
  seed.exclude_from_item_count,
  seed.exclude_from_policy_count,
  NULL
FROM (
  VALUES
    ('Standard Auto', 'Auto', 5::numeric, true, false, false),
    ('Non-Standard Auto', 'Auto', 5::numeric, false, false, false),
    ('Specialty Auto', 'Auto', 5::numeric, false, false, false),
    ('Auto - Special', 'Auto', 5::numeric, false, false, false),
    ('Motorcycle', 'Auto', 5::numeric, true, false, false),
    ('Boatowners', 'Recreation', 5::numeric, true, false, false),
    ('Off-Road Vehicle', 'Recreation', 5::numeric, true, false, false),
    ('Homeowners', 'Property', 5::numeric, true, false, false),
    ('North Light Homeowners', 'Property', 5::numeric, true, false, false),
    ('Condo', 'Property', 5::numeric, true, false, false),
    ('North Light Condo', 'Property', 5::numeric, true, false, false),
    ('Renters', 'Property', 5::numeric, true, false, false),
    ('Landlords', 'Property', 5::numeric, true, false, false),
    ('Mobilehome', 'Property', 5::numeric, true, false, false),
    ('Personal Umbrella', 'Umbrella', 5::numeric, true, false, false),
    ('Motor Club', 'Service', 0::numeric, false, true, true)
) AS seed(name, category, default_points, is_vc_item, exclude_from_item_count, exclude_from_policy_count)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.product_types existing
  WHERE existing.agency_id IS NULL
    AND lower(existing.name) = lower(seed.name)
);

CREATE TABLE IF NOT EXISTS public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  team_member_id uuid NULL REFERENCES public.team_members(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  customer_email text NULL,
  customer_phone text NULL,
  customer_zip text NULL,
  sale_date date NULL,
  effective_date date NOT NULL,
  expiration_date date NULL,
  total_policies numeric NULL DEFAULT 0,
  total_items numeric NULL DEFAULT 0,
  total_premium numeric NULL DEFAULT 0,
  total_points numeric NULL DEFAULT 0,
  is_vc_qualifying boolean NULL DEFAULT false,
  vc_items numeric NULL DEFAULT 0,
  vc_premium numeric NULL DEFAULT 0,
  vc_points numeric NULL DEFAULT 0,
  is_bundle boolean NULL DEFAULT false,
  bundle_type text NULL,
  created_by uuid NULL,
  created_at timestamptz NULL DEFAULT now(),
  updated_at timestamptz NULL DEFAULT now(),
  policy_number text NULL,
  contact_id uuid NULL,
  lead_source_id uuid NULL,
  brokered_carrier_id uuid NULL,
  prior_insurance_company_id uuid NULL,
  existing_customer_products text[] NULL DEFAULT '{}'::text[],
  brokered_counts_toward_bundling boolean NULL DEFAULT false,
  is_one_call_close boolean NOT NULL DEFAULT false,
  source text NULL DEFAULT 'manual',
  source_details jsonb NULL DEFAULT '{}'::jsonb,
  subproducer_code text NULL
);

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS agency_id uuid,
  ADD COLUMN IF NOT EXISTS team_member_id uuid,
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS customer_email text NULL,
  ADD COLUMN IF NOT EXISTS customer_phone text NULL,
  ADD COLUMN IF NOT EXISTS customer_zip text NULL,
  ADD COLUMN IF NOT EXISTS sale_date date NULL,
  ADD COLUMN IF NOT EXISTS effective_date date,
  ADD COLUMN IF NOT EXISTS expiration_date date NULL,
  ADD COLUMN IF NOT EXISTS total_policies numeric NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_items numeric NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_premium numeric NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_points numeric NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_vc_qualifying boolean NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vc_items numeric NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vc_premium numeric NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vc_points numeric NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_bundle boolean NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bundle_type text NULL,
  ADD COLUMN IF NOT EXISTS created_by uuid NULL,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS policy_number text NULL,
  ADD COLUMN IF NOT EXISTS contact_id uuid NULL,
  ADD COLUMN IF NOT EXISTS lead_source_id uuid NULL,
  ADD COLUMN IF NOT EXISTS brokered_carrier_id uuid NULL,
  ADD COLUMN IF NOT EXISTS prior_insurance_company_id uuid NULL,
  ADD COLUMN IF NOT EXISTS existing_customer_products text[] NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS brokered_counts_toward_bundling boolean NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_one_call_close boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS source text NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS source_details jsonb NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS subproducer_code text NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sales_agency_id_fkey'
      AND conrelid = 'public.sales'::regclass
  ) THEN
    ALTER TABLE public.sales
      ADD CONSTRAINT sales_agency_id_fkey
      FOREIGN KEY (agency_id) REFERENCES public.agencies(id) ON DELETE CASCADE;
  END IF;

  IF to_regclass('public.team_members') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conname = 'sales_team_member_id_fkey'
         AND conrelid = 'public.sales'::regclass
     ) THEN
    ALTER TABLE public.sales
      ADD CONSTRAINT sales_team_member_id_fkey
      FOREIGN KEY (team_member_id) REFERENCES public.team_members(id) ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.agency_contacts') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conname = 'sales_contact_id_fkey'
         AND conrelid = 'public.sales'::regclass
     ) THEN
    ALTER TABLE public.sales
      ADD CONSTRAINT sales_contact_id_fkey
      FOREIGN KEY (contact_id) REFERENCES public.agency_contacts(id) ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.lead_sources') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conname = 'sales_lead_source_id_fkey'
         AND conrelid = 'public.sales'::regclass
     ) THEN
    ALTER TABLE public.sales
      ADD CONSTRAINT sales_lead_source_id_fkey
      FOREIGN KEY (lead_source_id) REFERENCES public.lead_sources(id) ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.brokered_carriers') IS NOT NULL
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

  IF to_regclass('public.prior_insurance_companies') IS NOT NULL
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
END
$$;

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_sales_agency_date
  ON public.sales (agency_id, sale_date DESC);

CREATE INDEX IF NOT EXISTS idx_sales_team_member_date
  ON public.sales (agency_id, team_member_id, sale_date DESC);

CREATE INDEX IF NOT EXISTS idx_sales_policy_number
  ON public.sales (policy_number)
  WHERE policy_number IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sales'
      AND policyname = 'Users can view their agency sales'
  ) THEN
    CREATE POLICY "Users can view their agency sales"
      ON public.sales
      FOR SELECT
      USING (has_agency_access(auth.uid(), agency_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sales'
      AND policyname = 'Users can insert sales for their agency'
  ) THEN
    CREATE POLICY "Users can insert sales for their agency"
      ON public.sales
      FOR INSERT
      WITH CHECK (has_agency_access(auth.uid(), agency_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sales'
      AND policyname = 'Users can update their agency sales'
  ) THEN
    CREATE POLICY "Users can update their agency sales"
      ON public.sales
      FOR UPDATE
      USING (has_agency_access(auth.uid(), agency_id))
      WITH CHECK (has_agency_access(auth.uid(), agency_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sales'
      AND policyname = 'Users can delete their agency sales'
  ) THEN
    CREATE POLICY "Users can delete their agency sales"
      ON public.sales
      FOR DELETE
      USING (has_agency_access(auth.uid(), agency_id));
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regprocedure('public.update_updated_at_column()') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS update_sales_updated_at ON public.sales;
    CREATE TRIGGER update_sales_updated_at
      BEFORE UPDATE ON public.sales
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.sales_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  team_member_id uuid NULL REFERENCES public.team_members(id) ON DELETE SET NULL,
  goal_name text NOT NULL,
  goal_focus text NOT NULL DEFAULT 'sales',
  measurement text NOT NULL,
  target_value numeric NOT NULL,
  effective_month text NULL,
  effective_year integer NULL,
  rank integer NULL,
  time_period text NOT NULL DEFAULT 'monthly',
  is_active boolean NULL DEFAULT true,
  created_at timestamptz NULL DEFAULT now(),
  updated_at timestamptz NULL DEFAULT now()
);

ALTER TABLE public.sales_goals
  ADD COLUMN IF NOT EXISTS agency_id uuid,
  ADD COLUMN IF NOT EXISTS team_member_id uuid NULL,
  ADD COLUMN IF NOT EXISTS goal_name text,
  ADD COLUMN IF NOT EXISTS goal_focus text NOT NULL DEFAULT 'sales',
  ADD COLUMN IF NOT EXISTS measurement text,
  ADD COLUMN IF NOT EXISTS target_value numeric,
  ADD COLUMN IF NOT EXISTS effective_month text NULL,
  ADD COLUMN IF NOT EXISTS effective_year integer NULL,
  ADD COLUMN IF NOT EXISTS rank integer NULL,
  ADD COLUMN IF NOT EXISTS time_period text NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS is_active boolean NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sales_goals_agency_id_fkey'
      AND conrelid = 'public.sales_goals'::regclass
  ) THEN
    ALTER TABLE public.sales_goals
      ADD CONSTRAINT sales_goals_agency_id_fkey
      FOREIGN KEY (agency_id) REFERENCES public.agencies(id) ON DELETE CASCADE;
  END IF;

  IF to_regclass('public.team_members') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conname = 'sales_goals_team_member_id_fkey'
         AND conrelid = 'public.sales_goals'::regclass
     ) THEN
    ALTER TABLE public.sales_goals
      ADD CONSTRAINT sales_goals_team_member_id_fkey
      FOREIGN KEY (team_member_id) REFERENCES public.team_members(id) ON DELETE SET NULL;
  END IF;
END
$$;

ALTER TABLE public.sales_goals ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_sales_goals_agency_active
  ON public.sales_goals (agency_id, is_active);

CREATE INDEX IF NOT EXISTS idx_sales_goals_team_member
  ON public.sales_goals (team_member_id)
  WHERE team_member_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sales_goals'
      AND policyname = 'Users can view their agency sales goals'
  ) THEN
    CREATE POLICY "Users can view their agency sales goals"
      ON public.sales_goals
      FOR SELECT
      USING (has_agency_access(auth.uid(), agency_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sales_goals'
      AND policyname = 'Users can manage their agency sales goals'
  ) THEN
    CREATE POLICY "Users can manage their agency sales goals"
      ON public.sales_goals
      FOR ALL
      USING (has_agency_access(auth.uid(), agency_id))
      WITH CHECK (has_agency_access(auth.uid(), agency_id));
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regprocedure('public.update_updated_at_column()') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS update_sales_goals_updated_at ON public.sales_goals;
    CREATE TRIGGER update_sales_goals_updated_at
      BEFORE UPDATE ON public.sales_goals
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.sale_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_type_id uuid NULL REFERENCES public.product_types(id) ON DELETE SET NULL,
  policy_type_name text NOT NULL,
  policy_number text NULL,
  effective_date date NOT NULL,
  expiration_date date NULL,
  total_items numeric NULL DEFAULT 0,
  total_premium numeric NULL DEFAULT 0,
  total_points numeric NULL DEFAULT 0,
  is_vc_qualifying boolean NULL DEFAULT false,
  created_at timestamptz NULL DEFAULT now(),
  brokered_carrier_id uuid NULL
);

ALTER TABLE public.sale_policies
  ADD COLUMN IF NOT EXISTS sale_id uuid,
  ADD COLUMN IF NOT EXISTS product_type_id uuid NULL,
  ADD COLUMN IF NOT EXISTS policy_type_name text,
  ADD COLUMN IF NOT EXISTS policy_number text NULL,
  ADD COLUMN IF NOT EXISTS effective_date date,
  ADD COLUMN IF NOT EXISTS expiration_date date NULL,
  ADD COLUMN IF NOT EXISTS total_items numeric NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_premium numeric NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_points numeric NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_vc_qualifying boolean NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS brokered_carrier_id uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sale_policies_sale_id_fkey'
      AND conrelid = 'public.sale_policies'::regclass
  ) THEN
    ALTER TABLE public.sale_policies
      ADD CONSTRAINT sale_policies_sale_id_fkey
      FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sale_policies_product_type_id_fkey'
      AND conrelid = 'public.sale_policies'::regclass
  ) THEN
    ALTER TABLE public.sale_policies
      ADD CONSTRAINT sale_policies_product_type_id_fkey
      FOREIGN KEY (product_type_id) REFERENCES public.product_types(id) ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.brokered_carriers') IS NOT NULL
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

ALTER TABLE public.sale_policies ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_sale_policies_sale_id
  ON public.sale_policies (sale_id);

CREATE INDEX IF NOT EXISTS idx_sale_policies_product_type_id
  ON public.sale_policies (product_type_id);

CREATE INDEX IF NOT EXISTS idx_sale_policies_policy_number
  ON public.sale_policies (policy_number)
  WHERE policy_number IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sale_policies'
      AND policyname = 'Users can view their agency sale policies'
  ) THEN
    CREATE POLICY "Users can view their agency sale policies"
      ON public.sale_policies
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.sales s
          WHERE s.id = sale_policies.sale_id
            AND has_agency_access(auth.uid(), s.agency_id)
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sale_policies'
      AND policyname = 'Users can insert their agency sale policies'
  ) THEN
    CREATE POLICY "Users can insert their agency sale policies"
      ON public.sale_policies
      FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.sales s
          WHERE s.id = sale_policies.sale_id
            AND has_agency_access(auth.uid(), s.agency_id)
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sale_policies'
      AND policyname = 'Users can update their agency sale policies'
  ) THEN
    CREATE POLICY "Users can update their agency sale policies"
      ON public.sale_policies
      FOR UPDATE
      USING (
        EXISTS (
          SELECT 1
          FROM public.sales s
          WHERE s.id = sale_policies.sale_id
            AND has_agency_access(auth.uid(), s.agency_id)
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.sales s
          WHERE s.id = sale_policies.sale_id
            AND has_agency_access(auth.uid(), s.agency_id)
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sale_policies'
      AND policyname = 'Users can delete their agency sale policies'
  ) THEN
    CREATE POLICY "Users can delete their agency sale policies"
      ON public.sale_policies
      FOR DELETE
      USING (
        EXISTS (
          SELECT 1
          FROM public.sales s
          WHERE s.id = sale_policies.sale_id
            AND has_agency_access(auth.uid(), s.agency_id)
        )
      );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  sale_policy_id uuid NULL REFERENCES public.sale_policies(id) ON DELETE CASCADE,
  product_type_id uuid NULL REFERENCES public.product_types(id) ON DELETE SET NULL,
  product_type_name text NOT NULL,
  item_count numeric NULL DEFAULT 1,
  premium numeric NULL DEFAULT 0,
  points numeric NULL DEFAULT 0,
  is_vc_qualifying boolean NULL DEFAULT false,
  created_at timestamptz NULL DEFAULT now()
);

ALTER TABLE public.sale_items
  ADD COLUMN IF NOT EXISTS sale_id uuid,
  ADD COLUMN IF NOT EXISTS sale_policy_id uuid NULL,
  ADD COLUMN IF NOT EXISTS product_type_id uuid NULL,
  ADD COLUMN IF NOT EXISTS product_type_name text,
  ADD COLUMN IF NOT EXISTS item_count numeric NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS premium numeric NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS points numeric NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_vc_qualifying boolean NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sale_items_sale_id_fkey'
      AND conrelid = 'public.sale_items'::regclass
  ) THEN
    ALTER TABLE public.sale_items
      ADD CONSTRAINT sale_items_sale_id_fkey
      FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sale_items_sale_policy_id_fkey'
      AND conrelid = 'public.sale_items'::regclass
  ) THEN
    ALTER TABLE public.sale_items
      ADD CONSTRAINT sale_items_sale_policy_id_fkey
      FOREIGN KEY (sale_policy_id) REFERENCES public.sale_policies(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sale_items_product_type_id_fkey'
      AND conrelid = 'public.sale_items'::regclass
  ) THEN
    ALTER TABLE public.sale_items
      ADD CONSTRAINT sale_items_product_type_id_fkey
      FOREIGN KEY (product_type_id) REFERENCES public.product_types(id) ON DELETE SET NULL;
  END IF;
END
$$;

ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id
  ON public.sale_items (sale_id);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale_policy_id
  ON public.sale_items (sale_policy_id);

CREATE INDEX IF NOT EXISTS idx_sale_items_product_type_id
  ON public.sale_items (product_type_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sale_items'
      AND policyname = 'Users can view their agency sale items'
  ) THEN
    CREATE POLICY "Users can view their agency sale items"
      ON public.sale_items
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.sales s
          WHERE s.id = sale_items.sale_id
            AND has_agency_access(auth.uid(), s.agency_id)
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sale_items'
      AND policyname = 'Users can insert their agency sale items'
  ) THEN
    CREATE POLICY "Users can insert their agency sale items"
      ON public.sale_items
      FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.sales s
          WHERE s.id = sale_items.sale_id
            AND has_agency_access(auth.uid(), s.agency_id)
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sale_items'
      AND policyname = 'Users can update their agency sale items'
  ) THEN
    CREATE POLICY "Users can update their agency sale items"
      ON public.sale_items
      FOR UPDATE
      USING (
        EXISTS (
          SELECT 1
          FROM public.sales s
          WHERE s.id = sale_items.sale_id
            AND has_agency_access(auth.uid(), s.agency_id)
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.sales s
          WHERE s.id = sale_items.sale_id
            AND has_agency_access(auth.uid(), s.agency_id)
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sale_items'
      AND policyname = 'Users can delete their agency sale items'
  ) THEN
    CREATE POLICY "Users can delete their agency sale items"
      ON public.sale_items
      FOR DELETE
      USING (
        EXISTS (
          SELECT 1
          FROM public.sales s
          WHERE s.id = sale_items.sale_id
            AND has_agency_access(auth.uid(), s.agency_id)
        )
      );
  END IF;
END
$$;
