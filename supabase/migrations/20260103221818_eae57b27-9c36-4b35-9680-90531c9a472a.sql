-- Compensation Plans (one per plan, assigned to multiple staff)
CREATE TABLE public.comp_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid REFERENCES public.agencies(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  
  -- What metric determines tier advancement
  -- Options: 'premium', 'items', 'points', 'policies', 'households'
  tier_metric text NOT NULL DEFAULT 'premium',
  
  -- What the commission rate applies to
  -- Options: 'percent_premium', 'per_item', 'per_point', 'per_policy'
  payout_type text NOT NULL DEFAULT 'percent_premium',
  
  -- Optional: Only count specific policy types toward tier qualification
  -- If null, count all policy types
  policy_type_filter uuid[] DEFAULT NULL,
  
  -- Chargeback rules: 'full', 'three_month', 'none'
  chargeback_rule text NOT NULL DEFAULT 'full',
  
  -- Brokered business settings (non-Allstate)
  brokered_flat_rate numeric(10,2) DEFAULT 0,
  brokered_counts_toward_tier boolean DEFAULT false,
  
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Commission Tiers (progressive levels within a plan)
CREATE TABLE public.comp_plan_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comp_plan_id uuid REFERENCES public.comp_plans(id) ON DELETE CASCADE NOT NULL,
  
  -- Minimum to qualify (could be $, items, points, policies, or households based on tier_metric)
  min_threshold numeric(12,2) NOT NULL,
  
  -- Either % or flat $ depending on payout_type
  commission_value numeric(10,2) NOT NULL,
  
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Staff assigned to comp plans (one staff = one active plan)
CREATE TABLE public.comp_plan_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comp_plan_id uuid REFERENCES public.comp_plans(id) ON DELETE CASCADE NOT NULL,
  team_member_id uuid REFERENCES public.team_members(id) ON DELETE CASCADE NOT NULL,
  
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date, -- NULL = currently active
  
  created_at timestamptz DEFAULT now(),
  
  UNIQUE(team_member_id, effective_date)
);

-- Monthly payout records (calculated from comp analyzer)
CREATE TABLE public.comp_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid REFERENCES public.agencies(id) ON DELETE CASCADE NOT NULL,
  team_member_id uuid REFERENCES public.team_members(id) ON DELETE CASCADE NOT NULL,
  comp_plan_id uuid REFERENCES public.comp_plans(id) ON DELETE SET NULL,
  
  period_month int NOT NULL,
  period_year int NOT NULL,
  
  -- Written totals (from sales dashboard - determines tier)
  written_premium numeric(12,2) DEFAULT 0,
  written_items int DEFAULT 0,
  written_points numeric(12,2) DEFAULT 0,
  written_policies int DEFAULT 0,
  written_households int DEFAULT 0,
  
  -- Issued totals (from comp analyzer - determines payout base)
  issued_premium numeric(12,2) DEFAULT 0,
  issued_items int DEFAULT 0,
  issued_points numeric(12,2) DEFAULT 0,
  issued_policies int DEFAULT 0,
  
  -- Chargebacks
  chargeback_premium numeric(12,2) DEFAULT 0,
  chargeback_count int DEFAULT 0,
  
  -- Net (issued minus chargebacks)
  net_premium numeric(12,2) DEFAULT 0,
  net_items int DEFAULT 0,
  
  -- Tier achieved (based on written metric)
  tier_threshold_met numeric(12,2) DEFAULT 0,
  tier_commission_value numeric(10,2) DEFAULT 0,
  
  -- Commission calculation
  base_commission numeric(12,2) DEFAULT 0,
  bonus_amount numeric(12,2) DEFAULT 0,
  total_payout numeric(12,2) DEFAULT 0,
  
  -- Rollover (written but not issued - carries to next month)
  rollover_premium numeric(12,2) DEFAULT 0,
  
  -- Status: 'draft', 'finalized', 'paid'
  status text DEFAULT 'draft',
  finalized_at timestamptz,
  paid_at timestamptz,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(team_member_id, period_month, period_year)
);

-- Create indexes for performance
CREATE INDEX idx_comp_plans_agency ON public.comp_plans(agency_id);
CREATE INDEX idx_comp_plan_tiers_plan ON public.comp_plan_tiers(comp_plan_id);
CREATE INDEX idx_comp_plan_assignments_plan ON public.comp_plan_assignments(comp_plan_id);
CREATE INDEX idx_comp_plan_assignments_member ON public.comp_plan_assignments(team_member_id);
CREATE INDEX idx_comp_payouts_agency ON public.comp_payouts(agency_id);
CREATE INDEX idx_comp_payouts_member ON public.comp_payouts(team_member_id);
CREATE INDEX idx_comp_payouts_period ON public.comp_payouts(period_year, period_month);

-- Enable RLS
ALTER TABLE public.comp_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comp_plan_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comp_plan_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comp_payouts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for comp_plans
CREATE POLICY "Users can view their agency comp plans"
  ON public.comp_plans FOR SELECT
  USING (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Users can insert their agency comp plans"
  ON public.comp_plans FOR INSERT
  WITH CHECK (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Users can update their agency comp plans"
  ON public.comp_plans FOR UPDATE
  USING (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Users can delete their agency comp plans"
  ON public.comp_plans FOR DELETE
  USING (has_agency_access(auth.uid(), agency_id));

-- RLS Policies for comp_plan_tiers
CREATE POLICY "Users can view tiers for their agency plans"
  ON public.comp_plan_tiers FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.comp_plans cp 
    WHERE cp.id = comp_plan_tiers.comp_plan_id 
    AND has_agency_access(auth.uid(), cp.agency_id)
  ));

CREATE POLICY "Users can insert tiers for their agency plans"
  ON public.comp_plan_tiers FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.comp_plans cp 
    WHERE cp.id = comp_plan_tiers.comp_plan_id 
    AND has_agency_access(auth.uid(), cp.agency_id)
  ));

CREATE POLICY "Users can update tiers for their agency plans"
  ON public.comp_plan_tiers FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.comp_plans cp 
    WHERE cp.id = comp_plan_tiers.comp_plan_id 
    AND has_agency_access(auth.uid(), cp.agency_id)
  ));

CREATE POLICY "Users can delete tiers for their agency plans"
  ON public.comp_plan_tiers FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.comp_plans cp 
    WHERE cp.id = comp_plan_tiers.comp_plan_id 
    AND has_agency_access(auth.uid(), cp.agency_id)
  ));

-- RLS Policies for comp_plan_assignments
CREATE POLICY "Users can view assignments for their agency plans"
  ON public.comp_plan_assignments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.comp_plans cp 
    WHERE cp.id = comp_plan_assignments.comp_plan_id 
    AND has_agency_access(auth.uid(), cp.agency_id)
  ));

CREATE POLICY "Users can insert assignments for their agency plans"
  ON public.comp_plan_assignments FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.comp_plans cp 
    WHERE cp.id = comp_plan_assignments.comp_plan_id 
    AND has_agency_access(auth.uid(), cp.agency_id)
  ));

CREATE POLICY "Users can update assignments for their agency plans"
  ON public.comp_plan_assignments FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.comp_plans cp 
    WHERE cp.id = comp_plan_assignments.comp_plan_id 
    AND has_agency_access(auth.uid(), cp.agency_id)
  ));

CREATE POLICY "Users can delete assignments for their agency plans"
  ON public.comp_plan_assignments FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.comp_plans cp 
    WHERE cp.id = comp_plan_assignments.comp_plan_id 
    AND has_agency_access(auth.uid(), cp.agency_id)
  ));

-- RLS Policies for comp_payouts
CREATE POLICY "Users can view their agency payouts"
  ON public.comp_payouts FOR SELECT
  USING (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Users can insert their agency payouts"
  ON public.comp_payouts FOR INSERT
  WITH CHECK (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Users can update their agency payouts"
  ON public.comp_payouts FOR UPDATE
  USING (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Users can delete their agency payouts"
  ON public.comp_payouts FOR DELETE
  USING (has_agency_access(auth.uid(), agency_id));

-- Trigger for updated_at on comp_plans
CREATE TRIGGER update_comp_plans_updated_at
  BEFORE UPDATE ON public.comp_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Trigger for updated_at on comp_payouts
CREATE TRIGGER update_comp_payouts_updated_at
  BEFORE UPDATE ON public.comp_payouts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();