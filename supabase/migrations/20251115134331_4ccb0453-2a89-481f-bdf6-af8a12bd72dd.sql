-- Enable multi-target support for life targets
-- Create brainstorm table to store multiple targets per domain
CREATE TABLE IF NOT EXISTS life_targets_brainstorm (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quarter TEXT NOT NULL,
  domain TEXT NOT NULL CHECK (domain IN ('body', 'being', 'balance', 'business')),
  target_text TEXT NOT NULL,
  clarity_score INTEGER CHECK (clarity_score >= 0 AND clarity_score <= 10),
  rewritten_target TEXT,
  is_selected BOOLEAN DEFAULT false,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, quarter, domain, target_text)
);

-- Enable RLS on brainstorm table
ALTER TABLE life_targets_brainstorm ENABLE ROW LEVEL SECURITY;

-- Users can manage their own brainstormed targets
CREATE POLICY "Users can manage their own brainstormed targets"
  ON life_targets_brainstorm
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all brainstormed targets
CREATE POLICY "Admins can view all brainstormed targets"
  ON life_targets_brainstorm
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Add target2 fields to life_targets_quarterly to support 2 targets per domain
ALTER TABLE life_targets_quarterly
  ADD COLUMN IF NOT EXISTS body_target2 TEXT,
  ADD COLUMN IF NOT EXISTS body_narrative2 TEXT,
  ADD COLUMN IF NOT EXISTS being_target2 TEXT,
  ADD COLUMN IF NOT EXISTS being_narrative2 TEXT,
  ADD COLUMN IF NOT EXISTS balance_target2 TEXT,
  ADD COLUMN IF NOT EXISTS balance_narrative2 TEXT,
  ADD COLUMN IF NOT EXISTS business_target2 TEXT,
  ADD COLUMN IF NOT EXISTS business_narrative2 TEXT;

-- Add columns to track which is primary (true = target1 is primary, false = target2 is primary, null = not set)
ALTER TABLE life_targets_quarterly
  ADD COLUMN IF NOT EXISTS body_primary_is_target1 BOOLEAN,
  ADD COLUMN IF NOT EXISTS being_primary_is_target1 BOOLEAN,
  ADD COLUMN IF NOT EXISTS balance_primary_is_target1 BOOLEAN,
  ADD COLUMN IF NOT EXISTS business_primary_is_target1 BOOLEAN;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_life_targets_brainstorm_user_quarter 
  ON life_targets_brainstorm(user_id, quarter);

CREATE INDEX IF NOT EXISTS idx_life_targets_brainstorm_domain 
  ON life_targets_brainstorm(domain) WHERE is_selected = true;