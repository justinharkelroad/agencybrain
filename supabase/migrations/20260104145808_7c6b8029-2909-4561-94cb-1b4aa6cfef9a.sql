-- Add brokered payout type column to comp_plans
ALTER TABLE public.comp_plans 
ADD COLUMN IF NOT EXISTS brokered_payout_type text DEFAULT 'flat_per_item';

-- Create table for brokered tiers (similar to comp_plan_tiers)
CREATE TABLE IF NOT EXISTS public.comp_plan_brokered_tiers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  comp_plan_id UUID NOT NULL REFERENCES public.comp_plans(id) ON DELETE CASCADE,
  min_threshold numeric NOT NULL DEFAULT 0,
  commission_value numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.comp_plan_brokered_tiers ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (matching comp_plan_tiers pattern using has_agency_access)
CREATE POLICY "Users can view brokered tiers for their agency plans"
ON public.comp_plan_brokered_tiers
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.comp_plans cp
    WHERE cp.id = comp_plan_brokered_tiers.comp_plan_id
    AND has_agency_access(auth.uid(), cp.agency_id)
  )
);

CREATE POLICY "Users can insert brokered tiers for their agency plans"
ON public.comp_plan_brokered_tiers
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.comp_plans cp
    WHERE cp.id = comp_plan_brokered_tiers.comp_plan_id
    AND has_agency_access(auth.uid(), cp.agency_id)
  )
);

CREATE POLICY "Users can update brokered tiers for their agency plans"
ON public.comp_plan_brokered_tiers
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.comp_plans cp
    WHERE cp.id = comp_plan_brokered_tiers.comp_plan_id
    AND has_agency_access(auth.uid(), cp.agency_id)
  )
);

CREATE POLICY "Users can delete brokered tiers for their agency plans"
ON public.comp_plan_brokered_tiers
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.comp_plans cp
    WHERE cp.id = comp_plan_brokered_tiers.comp_plan_id
    AND has_agency_access(auth.uid(), cp.agency_id)
  )
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_comp_plan_brokered_tiers_plan_id 
ON public.comp_plan_brokered_tiers(comp_plan_id);