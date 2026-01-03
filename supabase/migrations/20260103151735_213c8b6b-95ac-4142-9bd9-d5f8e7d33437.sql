-- Phase 1: Add promo columns to sales_goals table
ALTER TABLE public.sales_goals ADD COLUMN IF NOT EXISTS goal_type text DEFAULT 'standard' CHECK (goal_type IN ('standard', 'promo'));
ALTER TABLE public.sales_goals ADD COLUMN IF NOT EXISTS bonus_amount_cents integer;
ALTER TABLE public.sales_goals ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.sales_goals ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE public.sales_goals ADD COLUMN IF NOT EXISTS end_date date;
ALTER TABLE public.sales_goals ADD COLUMN IF NOT EXISTS promo_source text CHECK (promo_source IN ('sales', 'metrics'));
ALTER TABLE public.sales_goals ADD COLUMN IF NOT EXISTS product_type_id uuid REFERENCES public.product_types(id);
ALTER TABLE public.sales_goals ADD COLUMN IF NOT EXISTS kpi_slug text;

-- Phase 2: Create junction table for multi-staff promo assignments
CREATE TABLE IF NOT EXISTS public.sales_goal_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_goal_id uuid NOT NULL REFERENCES public.sales_goals(id) ON DELETE CASCADE,
  team_member_id uuid NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(sales_goal_id, team_member_id)
);

-- Enable RLS on the new table
ALTER TABLE public.sales_goal_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view assignments for their agency goals
CREATE POLICY "Users can view assignments for their agency goals"
ON public.sales_goal_assignments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.sales_goals sg
    WHERE sg.id = sales_goal_id
    AND has_agency_access(auth.uid(), sg.agency_id)
  )
);

-- RLS Policy: Agency owners/admins can manage assignments
CREATE POLICY "Agency users can manage promo assignments"
ON public.sales_goal_assignments FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.sales_goals sg
    JOIN public.profiles p ON p.agency_id = sg.agency_id
    WHERE sg.id = sales_goal_id
    AND p.id = auth.uid()
    AND (p.role = 'admin' OR p.agency_id = sg.agency_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.sales_goals sg
    JOIN public.profiles p ON p.agency_id = sg.agency_id
    WHERE sg.id = sales_goal_id
    AND p.id = auth.uid()
    AND (p.role = 'admin' OR p.agency_id = sg.agency_id)
  )
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_sales_goal_assignments_goal ON public.sales_goal_assignments(sales_goal_id);
CREATE INDEX IF NOT EXISTS idx_sales_goal_assignments_member ON public.sales_goal_assignments(team_member_id);
CREATE INDEX IF NOT EXISTS idx_sales_goals_goal_type ON public.sales_goals(goal_type);
CREATE INDEX IF NOT EXISTS idx_sales_goals_promo_dates ON public.sales_goals(start_date, end_date) WHERE goal_type = 'promo';