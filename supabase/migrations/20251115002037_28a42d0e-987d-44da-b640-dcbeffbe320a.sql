-- Drop the existing life_targets_quarterly table and recreate with correct schema
DROP TABLE IF EXISTS public.life_targets_quarterly CASCADE;

-- Create life_targets_quarterly table for USER's personal quarterly life targets
CREATE TABLE public.life_targets_quarterly (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quarter text NOT NULL,
  
  -- Body domain
  body_target text,
  body_monthly_missions jsonb DEFAULT '{"Jan": [], "Feb": [], "Mar": []}'::jsonb,
  body_daily_habit text,
  body_narrative text,
  
  -- Being domain
  being_target text,
  being_monthly_missions jsonb DEFAULT '{"Jan": [], "Feb": [], "Mar": []}'::jsonb,
  being_daily_habit text,
  being_narrative text,
  
  -- Balance domain
  balance_target text,
  balance_monthly_missions jsonb DEFAULT '{"Jan": [], "Feb": [], "Mar": []}'::jsonb,
  balance_daily_habit text,
  balance_narrative text,
  
  -- Business domain
  business_target text,
  business_monthly_missions jsonb DEFAULT '{"Jan": [], "Feb": [], "Mar": []}'::jsonb,
  business_daily_habit text,
  business_narrative text,
  
  -- Optional: raw session data for debugging
  raw_session_data jsonb,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Ensure one plan per user per quarter
  UNIQUE(user_id, quarter)
);

-- Create indexes
CREATE INDEX idx_life_targets_user_id ON public.life_targets_quarterly(user_id);
CREATE INDEX idx_life_targets_quarter ON public.life_targets_quarterly(quarter);

-- Enable RLS
ALTER TABLE public.life_targets_quarterly ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can manage their own life targets
CREATE POLICY "Users can manage their own life targets"
ON public.life_targets_quarterly
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Admins can view all life targets
CREATE POLICY "Admins can view all life targets"
ON public.life_targets_quarterly
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_life_targets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_life_targets_updated_at
  BEFORE UPDATE ON public.life_targets_quarterly
  FOR EACH ROW
  EXECUTE FUNCTION update_life_targets_updated_at();