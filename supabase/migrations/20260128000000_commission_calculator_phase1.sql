-- Commission Calculator Fix - Phase 1: Database Migrations
-- This migration adds all schema changes needed for the commission calculator enhancements
--
-- Changes:
-- 1. comp_plans: tier_metric_source (written vs issued configuration)
-- 2. product_types: term_months (for full-term chargeback calculations)
-- 3. product_types: is_brokered (flag for brokered products)
-- 4. brokered_carriers: new table for tracking brokered carriers
-- 5. sales: brokered_carrier_id (link sales to brokered carriers)
-- 6. comp_payouts: audit trail columns
-- 7. comp_statement_uploads: content_hash (for duplicate detection)

-- ============================================
-- 1. comp_plans - Written vs Issued Configuration
-- ============================================
ALTER TABLE comp_plans ADD COLUMN IF NOT EXISTS tier_metric_source text NOT NULL DEFAULT 'written';

COMMENT ON COLUMN comp_plans.tier_metric_source IS 'Source for tier qualification: written or issued. Payout always uses issued premium.';

-- ============================================
-- 2. product_types - Term Months for Chargeback Logic
-- ============================================
ALTER TABLE product_types ADD COLUMN IF NOT EXISTS term_months integer NOT NULL DEFAULT 12;

COMMENT ON COLUMN product_types.term_months IS 'Policy term in months for full-term chargeback calculations. Auto=6, Home/Other=12.';

-- Update standard auto policies to 6-month term
UPDATE product_types
SET term_months = 6
WHERE (LOWER(name) LIKE '%standard auto%' OR LOWER(name) = 'auto' OR category = 'auto')
  AND LOWER(name) NOT LIKE '%specialty%'
  AND term_months = 12;

-- ============================================
-- 3. product_types - Brokered Flag
-- ============================================
ALTER TABLE product_types ADD COLUMN IF NOT EXISTS is_brokered boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN product_types.is_brokered IS 'True if this product type is brokered through a non-captive carrier.';

-- ============================================
-- 4. brokered_carriers - New Table
-- ============================================
CREATE TABLE IF NOT EXISTS brokered_carriers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(agency_id, name)
);

COMMENT ON TABLE brokered_carriers IS 'Brokered insurance carriers that an agency works with outside their primary carrier.';

-- Create index for agency lookups
CREATE INDEX IF NOT EXISTS idx_brokered_carriers_agency_id ON brokered_carriers(agency_id);
CREATE INDEX IF NOT EXISTS idx_brokered_carriers_active ON brokered_carriers(agency_id, is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE brokered_carriers ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their agency brokered carriers"
  ON brokered_carriers FOR SELECT
  USING (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Users can insert their agency brokered carriers"
  ON brokered_carriers FOR INSERT
  WITH CHECK (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Users can update their agency brokered carriers"
  ON brokered_carriers FOR UPDATE
  USING (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Users can delete their agency brokered carriers"
  ON brokered_carriers FOR DELETE
  USING (has_agency_access(auth.uid(), agency_id));

-- Updated_at trigger
CREATE TRIGGER update_brokered_carriers_updated_at
  BEFORE UPDATE ON brokered_carriers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 5. sales - Brokered Carrier Reference
-- ============================================
ALTER TABLE sales ADD COLUMN IF NOT EXISTS brokered_carrier_id uuid REFERENCES brokered_carriers(id);

CREATE INDEX IF NOT EXISTS idx_sales_brokered_carrier ON sales(brokered_carrier_id) WHERE brokered_carrier_id IS NOT NULL;

COMMENT ON COLUMN sales.brokered_carrier_id IS 'If set, this sale is brokered business through the specified carrier.';

-- ============================================
-- 6. comp_payouts - Audit Trail Columns
-- ============================================
-- Self-gen tracking
ALTER TABLE comp_payouts ADD COLUMN IF NOT EXISTS self_gen_percent numeric;
ALTER TABLE comp_payouts ADD COLUMN IF NOT EXISTS self_gen_met_requirement boolean;
ALTER TABLE comp_payouts ADD COLUMN IF NOT EXISTS self_gen_penalty_amount numeric DEFAULT 0;
ALTER TABLE comp_payouts ADD COLUMN IF NOT EXISTS self_gen_bonus_amount numeric DEFAULT 0;

-- Bundling tracking
ALTER TABLE comp_payouts ADD COLUMN IF NOT EXISTS bundling_percent numeric;
ALTER TABLE comp_payouts ADD COLUMN IF NOT EXISTS bundling_multiplier numeric DEFAULT 1;

-- Brokered commission tracking
ALTER TABLE comp_payouts ADD COLUMN IF NOT EXISTS brokered_commission numeric DEFAULT 0;

-- Detailed audit data (JSONB)
ALTER TABLE comp_payouts ADD COLUMN IF NOT EXISTS chargeback_details_json jsonb;
ALTER TABLE comp_payouts ADD COLUMN IF NOT EXISTS calculation_snapshot_json jsonb;

COMMENT ON COLUMN comp_payouts.self_gen_percent IS 'Calculated self-gen percentage for this payout period.';
COMMENT ON COLUMN comp_payouts.self_gen_met_requirement IS 'Whether the self-gen requirement was met for this period.';
COMMENT ON COLUMN comp_payouts.self_gen_penalty_amount IS 'Dollar amount deducted due to self-gen penalty.';
COMMENT ON COLUMN comp_payouts.self_gen_bonus_amount IS 'Dollar amount added from self-gen bonus.';
COMMENT ON COLUMN comp_payouts.bundling_percent IS 'Calculated bundling percentage for this payout period.';
COMMENT ON COLUMN comp_payouts.bundling_multiplier IS 'Multiplier applied based on bundling percentage (1.0 = no multiplier).';
COMMENT ON COLUMN comp_payouts.brokered_commission IS 'Commission earned from brokered business.';
COMMENT ON COLUMN comp_payouts.chargeback_details_json IS 'Detailed breakdown of each chargeback included/excluded.';
COMMENT ON COLUMN comp_payouts.calculation_snapshot_json IS 'Full calculation breakdown for audit trail.';

-- ============================================
-- 7. comp_statement_uploads - Content Hash
-- ============================================
ALTER TABLE comp_statement_uploads ADD COLUMN IF NOT EXISTS content_hash text;

CREATE INDEX IF NOT EXISTS idx_statement_uploads_content_hash ON comp_statement_uploads(agency_id, content_hash);

COMMENT ON COLUMN comp_statement_uploads.content_hash IS 'SHA-256 hash of file contents for duplicate detection.';
