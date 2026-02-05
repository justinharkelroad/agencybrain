-- Migration: Sequence Type Options - Admin-Managed Categories
-- Date: 2026-02-05
-- Description: Creates admin-managed sequence type options table, migrates target_type
--              from ENUM to TEXT, and adds custom_type_label for "Other" category.

-- ============================================
-- TABLE: sequence_type_options
-- Global admin-managed sequence type options
-- ============================================
CREATE TABLE IF NOT EXISTS sequence_type_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type_key TEXT NOT NULL UNIQUE,           -- Internal key (e.g., 'onboarding', 'lead_nurturing')
  label TEXT NOT NULL,                     -- Display name
  description TEXT,                        -- Subheadline/description
  is_active BOOLEAN NOT NULL DEFAULT true, -- Show in dropdown
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sequence_type_options_active ON sequence_type_options(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_sequence_type_options_sort ON sequence_type_options(sort_order);

-- Seed with current defaults
INSERT INTO sequence_type_options (type_key, label, description, sort_order) VALUES
  ('onboarding', 'New Customer Onboarding', 'For newly sold policies', 1),
  ('lead_nurturing', 'Lead Nurturing', 'For prospects not yet sold', 2),
  ('requote', 'Re-quote Campaign', 'For upcoming renewals', 3),
  ('retention', 'Retention', 'For at-risk customers', 4),
  ('other', 'Other', 'Custom workflow', 99)
ON CONFLICT (type_key) DO NOTHING;

-- RLS: Anyone authenticated can read, only admins can write
ALTER TABLE sequence_type_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sequence_type_options_select" ON sequence_type_options
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "sequence_type_options_admin_insert" ON sequence_type_options
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "sequence_type_options_admin_update" ON sequence_type_options
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "sequence_type_options_admin_delete" ON sequence_type_options
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Permissions
GRANT SELECT ON sequence_type_options TO authenticated;
GRANT INSERT, UPDATE, DELETE ON sequence_type_options TO authenticated;

-- ============================================
-- MIGRATE target_type FROM ENUM TO TEXT
-- ============================================

-- Step 1: Add a temporary TEXT column
ALTER TABLE onboarding_sequences ADD COLUMN IF NOT EXISTS target_type_text TEXT;

-- Step 2: Copy data from enum to text
UPDATE onboarding_sequences
SET target_type_text = target_type::TEXT
WHERE target_type_text IS NULL;

-- Step 3: Drop the old enum column
ALTER TABLE onboarding_sequences DROP COLUMN IF EXISTS target_type;

-- Step 4: Rename the text column to target_type
ALTER TABLE onboarding_sequences RENAME COLUMN target_type_text TO target_type;

-- Step 5: Set NOT NULL and default
ALTER TABLE onboarding_sequences
  ALTER COLUMN target_type SET NOT NULL,
  ALTER COLUMN target_type SET DEFAULT 'onboarding';

-- Step 6: Create index on target_type
CREATE INDEX IF NOT EXISTS idx_onboarding_sequences_target_type_text
  ON onboarding_sequences(agency_id, target_type);

-- Drop the old index that was on the enum column (if it exists)
DROP INDEX IF EXISTS idx_onboarding_sequences_target_type;

-- ============================================
-- ADD custom_type_label FOR "Other" CATEGORY
-- ============================================
ALTER TABLE onboarding_sequences
  ADD COLUMN IF NOT EXISTS custom_type_label TEXT;

COMMENT ON COLUMN onboarding_sequences.custom_type_label IS
  'Custom category name when target_type is "other"';

-- ============================================
-- UPDATE updated_at TRIGGER for sequence_type_options
-- ============================================
CREATE OR REPLACE FUNCTION update_sequence_type_options_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sequence_type_options_updated_at ON sequence_type_options;
CREATE TRIGGER trg_sequence_type_options_updated_at
  BEFORE UPDATE ON sequence_type_options
  FOR EACH ROW
  EXECUTE FUNCTION update_sequence_type_options_updated_at();

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE sequence_type_options IS
  'Admin-managed sequence type options. Defines available categories for sequence templates.';
