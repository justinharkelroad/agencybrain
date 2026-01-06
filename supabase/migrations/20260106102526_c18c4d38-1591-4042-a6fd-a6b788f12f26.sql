-- ============================================
-- LQS Phase 1: Database Schema & Core Infrastructure
-- ============================================

-- Step 1: Create marketing_buckets table (MUST BE FIRST for FK reference)
CREATE TABLE public.marketing_buckets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  name text NOT NULL,
  commission_rate_percent numeric(5,2) NOT NULL DEFAULT 15.00,
  order_index integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_marketing_buckets_agency ON public.marketing_buckets(agency_id);
ALTER TABLE public.marketing_buckets ADD CONSTRAINT marketing_buckets_agency_name_unique UNIQUE (agency_id, name);

ALTER TABLE public.marketing_buckets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their agency marketing buckets"
  ON public.marketing_buckets FOR SELECT
  USING (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Users can insert marketing buckets for their agency"
  ON public.marketing_buckets FOR INSERT
  WITH CHECK (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Users can update their agency marketing buckets"
  ON public.marketing_buckets FOR UPDATE
  USING (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Users can delete their agency marketing buckets"
  ON public.marketing_buckets FOR DELETE
  USING (has_agency_access(auth.uid(), agency_id));

-- Step 2: Alter lead_sources table (NOW marketing_buckets exists for FK)
ALTER TABLE public.lead_sources 
  ADD COLUMN bucket_id uuid REFERENCES public.marketing_buckets(id) ON DELETE SET NULL,
  ADD COLUMN is_self_generated boolean NOT NULL DEFAULT false,
  ADD COLUMN cost_type text NOT NULL DEFAULT 'per_lead';

ALTER TABLE public.lead_sources 
  ADD CONSTRAINT lead_sources_cost_type_check 
  CHECK (cost_type IN ('per_lead', 'per_transfer', 'monthly_fixed', 'per_mailer'));

CREATE INDEX idx_lead_sources_bucket ON public.lead_sources(bucket_id);

-- Step 3: Create lead_source_monthly_spend table
CREATE TABLE public.lead_source_monthly_spend (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_source_id uuid NOT NULL REFERENCES public.lead_sources(id) ON DELETE CASCADE,
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  month date NOT NULL,
  cost_per_unit_cents integer NOT NULL DEFAULT 0,
  units_count integer NOT NULL DEFAULT 0,
  total_spend_cents integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_lead_source_monthly_spend_lookup ON public.lead_source_monthly_spend(lead_source_id, month);
CREATE INDEX idx_lead_source_monthly_spend_agency_month ON public.lead_source_monthly_spend(agency_id, month);
ALTER TABLE public.lead_source_monthly_spend ADD CONSTRAINT lead_source_monthly_spend_unique UNIQUE (lead_source_id, month);

ALTER TABLE public.lead_source_monthly_spend ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their agency lead source spend"
  ON public.lead_source_monthly_spend FOR SELECT
  USING (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Users can insert lead source spend for their agency"
  ON public.lead_source_monthly_spend FOR INSERT
  WITH CHECK (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Users can update their agency lead source spend"
  ON public.lead_source_monthly_spend FOR UPDATE
  USING (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Users can delete their agency lead source spend"
  ON public.lead_source_monthly_spend FOR DELETE
  USING (has_agency_access(auth.uid(), agency_id));

-- Step 4: Create lqs_households table
CREATE TABLE public.lqs_households (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  household_key text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  zip_code text NOT NULL,
  phone text,
  email text,
  lead_source_id uuid REFERENCES public.lead_sources(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'lead',
  lead_received_date date,
  first_quote_date date,
  sold_date date,
  team_member_id uuid REFERENCES public.team_members(id) ON DELETE SET NULL,
  needs_attention boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_lqs_households_agency ON public.lqs_households(agency_id);
CREATE INDEX idx_lqs_households_lookup ON public.lqs_households(agency_id, household_key);
CREATE INDEX idx_lqs_households_status ON public.lqs_households(agency_id, status);
CREATE INDEX idx_lqs_households_needs_attention ON public.lqs_households(agency_id, needs_attention) WHERE needs_attention = true;
CREATE INDEX idx_lqs_households_lead_source ON public.lqs_households(agency_id, lead_source_id);
CREATE INDEX idx_lqs_households_matching ON public.lqs_households(agency_id, last_name, zip_code);
ALTER TABLE public.lqs_households ADD CONSTRAINT lqs_households_agency_key_unique UNIQUE (agency_id, household_key);
ALTER TABLE public.lqs_households ADD CONSTRAINT lqs_households_status_check CHECK (status IN ('lead', 'quoted', 'sold'));

ALTER TABLE public.lqs_households ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their agency households"
  ON public.lqs_households FOR SELECT
  USING (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Users can insert households for their agency"
  ON public.lqs_households FOR INSERT
  WITH CHECK (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Users can update their agency households"
  ON public.lqs_households FOR UPDATE
  USING (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Users can delete their agency households"
  ON public.lqs_households FOR DELETE
  USING (has_agency_access(auth.uid(), agency_id));

-- Step 5: Create lqs_quotes table
CREATE TABLE public.lqs_quotes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES public.lqs_households(id) ON DELETE CASCADE,
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  team_member_id uuid REFERENCES public.team_members(id) ON DELETE SET NULL,
  quote_date date NOT NULL,
  product_type text NOT NULL,
  items_quoted integer NOT NULL DEFAULT 1,
  premium_cents integer NOT NULL DEFAULT 0,
  issued_policy_number text,
  source text NOT NULL DEFAULT 'manual',
  source_reference_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_lqs_quotes_household ON public.lqs_quotes(household_id);
CREATE INDEX idx_lqs_quotes_agency_date ON public.lqs_quotes(agency_id, quote_date);
CREATE INDEX idx_lqs_quotes_team_member ON public.lqs_quotes(agency_id, team_member_id, quote_date);
CREATE INDEX idx_lqs_quotes_product ON public.lqs_quotes(agency_id, product_type);
CREATE INDEX idx_lqs_quotes_dedup ON public.lqs_quotes(agency_id, household_id, quote_date, product_type);
ALTER TABLE public.lqs_quotes ADD CONSTRAINT lqs_quotes_source_check CHECK (source IN ('allstate_report', 'scorecard', 'manual', 'bulk_upload'));

ALTER TABLE public.lqs_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their agency quotes"
  ON public.lqs_quotes FOR SELECT
  USING (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Users can insert quotes for their agency"
  ON public.lqs_quotes FOR INSERT
  WITH CHECK (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Users can update their agency quotes"
  ON public.lqs_quotes FOR UPDATE
  USING (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Users can delete their agency quotes"
  ON public.lqs_quotes FOR DELETE
  USING (has_agency_access(auth.uid(), agency_id));

-- Step 6: Create lqs_sales table
CREATE TABLE public.lqs_sales (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES public.lqs_households(id) ON DELETE CASCADE,
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  team_member_id uuid REFERENCES public.team_members(id) ON DELETE SET NULL,
  sale_date date NOT NULL,
  product_type text NOT NULL,
  items_sold integer NOT NULL DEFAULT 1,
  policies_sold integer NOT NULL DEFAULT 1,
  premium_cents integer NOT NULL DEFAULT 0,
  policy_number text,
  source text NOT NULL DEFAULT 'manual',
  source_reference_id uuid,
  linked_quote_id uuid REFERENCES public.lqs_quotes(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_lqs_sales_household ON public.lqs_sales(household_id);
CREATE INDEX idx_lqs_sales_agency_date ON public.lqs_sales(agency_id, sale_date);
CREATE INDEX idx_lqs_sales_team_member ON public.lqs_sales(agency_id, team_member_id, sale_date);
ALTER TABLE public.lqs_sales ADD CONSTRAINT lqs_sales_source_check CHECK (source IN ('sales_dashboard', 'scorecard', 'manual'));

ALTER TABLE public.lqs_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their agency sales"
  ON public.lqs_sales FOR SELECT
  USING (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Users can insert sales for their agency"
  ON public.lqs_sales FOR INSERT
  WITH CHECK (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Users can update their agency sales"
  ON public.lqs_sales FOR UPDATE
  USING (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Users can delete their agency sales"
  ON public.lqs_sales FOR DELETE
  USING (has_agency_access(auth.uid(), agency_id));

-- Step 7: Create generate_household_key function
CREATE OR REPLACE FUNCTION public.generate_household_key(
  p_first_name TEXT,
  p_last_name TEXT,
  p_zip_code TEXT
) RETURNS TEXT AS $$
BEGIN
  RETURN UPPER(REGEXP_REPLACE(COALESCE(p_last_name, 'UNKNOWN'), '[^A-Z]', '', 'g')) || '_' ||
         UPPER(REGEXP_REPLACE(COALESCE(p_first_name, 'UNKNOWN'), '[^A-Z]', '', 'g')) || '_' ||
         COALESCE(LEFT(p_zip_code, 5), '00000');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Step 8: Create trigger function to update household status
CREATE OR REPLACE FUNCTION public.update_lqs_household_status()
RETURNS TRIGGER AS $$
DECLARE
  v_has_sales boolean;
  v_has_quotes boolean;
  v_first_quote_date date;
  v_sold_date date;
  v_new_status text;
BEGIN
  -- Check for sales
  SELECT EXISTS(SELECT 1 FROM public.lqs_sales WHERE household_id = NEW.household_id)
  INTO v_has_sales;
  
  -- Check for quotes
  SELECT EXISTS(SELECT 1 FROM public.lqs_quotes WHERE household_id = NEW.household_id)
  INTO v_has_quotes;
  
  -- Determine new status
  IF v_has_sales THEN
    v_new_status := 'sold';
  ELSIF v_has_quotes THEN
    v_new_status := 'quoted';
  ELSE
    v_new_status := 'lead';
  END IF;
  
  -- Get first quote date
  SELECT MIN(quote_date) INTO v_first_quote_date
  FROM public.lqs_quotes WHERE household_id = NEW.household_id;
  
  -- Get first sale date
  SELECT MIN(sale_date) INTO v_sold_date
  FROM public.lqs_sales WHERE household_id = NEW.household_id;
  
  -- Update household
  UPDATE public.lqs_households
  SET 
    status = v_new_status,
    first_quote_date = v_first_quote_date,
    sold_date = v_sold_date,
    updated_at = now()
  WHERE id = NEW.household_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Step 9: Create triggers on lqs_quotes and lqs_sales
CREATE TRIGGER trg_lqs_quotes_update_status
  AFTER INSERT ON public.lqs_quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_lqs_household_status();

CREATE TRIGGER trg_lqs_sales_update_status
  AFTER INSERT ON public.lqs_sales
  FOR EACH ROW
  EXECUTE FUNCTION public.update_lqs_household_status();