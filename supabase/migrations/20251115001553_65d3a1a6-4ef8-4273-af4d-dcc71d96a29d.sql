-- Create life_targets_quarterly table for Q1 Life Targets feature
CREATE TABLE IF NOT EXISTS public.life_targets_quarterly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id UUID NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  quarter TEXT NOT NULL,
  
  -- Body domain
  body_target TEXT,
  body_monthly_missions JSONB DEFAULT '{"Jan": [], "Feb": [], "Mar": []}'::jsonb,
  body_daily_habit TEXT,
  body_narrative TEXT,
  
  -- Being domain
  being_target TEXT,
  being_monthly_missions JSONB DEFAULT '{"Jan": [], "Feb": [], "Mar": []}'::jsonb,
  being_daily_habit TEXT,
  being_narrative TEXT,
  
  -- Balance domain
  balance_target TEXT,
  balance_monthly_missions JSONB DEFAULT '{"Jan": [], "Feb": [], "Mar": []}'::jsonb,
  balance_daily_habit TEXT,
  balance_narrative TEXT,
  
  -- Business domain
  business_target TEXT,
  business_monthly_missions JSONB DEFAULT '{"Jan": [], "Feb": [], "Mar": []}'::jsonb,
  business_daily_habit TEXT,
  business_narrative TEXT,
  
  -- Optional raw session data for debugging/history
  raw_session_data JSONB,
  
  -- Ensure one plan per team member per quarter
  UNIQUE(team_member_id, quarter)
);

-- Create indexes for common queries
CREATE INDEX idx_life_targets_agency_id ON public.life_targets_quarterly(agency_id);
CREATE INDEX idx_life_targets_team_member_id ON public.life_targets_quarterly(team_member_id);
CREATE INDEX idx_life_targets_quarter ON public.life_targets_quarterly(quarter);

-- Enable RLS
ALTER TABLE public.life_targets_quarterly ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can manage their agency's life targets
CREATE POLICY "Users can manage their agency life targets"
ON public.life_targets_quarterly
FOR ALL
USING (has_agency_access(auth.uid(), agency_id))
WITH CHECK (has_agency_access(auth.uid(), agency_id));

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_life_targets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_life_targets_updated_at
BEFORE UPDATE ON public.life_targets_quarterly
FOR EACH ROW
EXECUTE FUNCTION update_life_targets_updated_at();

-- Add comment for documentation
COMMENT ON TABLE public.life_targets_quarterly IS 'Stores quarterly life targets across 4 domains (Body, Being, Balance, Business) for team members. Single session flow with monthly missions and daily habits per domain.';