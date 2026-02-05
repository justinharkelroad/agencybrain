-- Add Prior Insurance Companies table
-- Tracks where customers had insurance before switching to this agency

-- ============================================
-- 1. prior_insurance_companies - New Table
-- ============================================
CREATE TABLE IF NOT EXISTS prior_insurance_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(agency_id, name)
);

COMMENT ON TABLE prior_insurance_companies IS 'Insurance companies that customers had before switching to this agency.';

-- Create indexes for agency lookups
CREATE INDEX IF NOT EXISTS idx_prior_insurance_companies_agency_id ON prior_insurance_companies(agency_id);
CREATE INDEX IF NOT EXISTS idx_prior_insurance_companies_active ON prior_insurance_companies(agency_id, is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE prior_insurance_companies ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their agency prior insurance companies"
  ON prior_insurance_companies FOR SELECT
  USING (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Users can insert their agency prior insurance companies"
  ON prior_insurance_companies FOR INSERT
  WITH CHECK (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Users can update their agency prior insurance companies"
  ON prior_insurance_companies FOR UPDATE
  USING (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Users can delete their agency prior insurance companies"
  ON prior_insurance_companies FOR DELETE
  USING (has_agency_access(auth.uid(), agency_id));

-- Updated_at trigger
CREATE TRIGGER update_prior_insurance_companies_updated_at
  BEFORE UPDATE ON prior_insurance_companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 2. sales - Prior Insurance Company Reference
-- ============================================
ALTER TABLE sales ADD COLUMN IF NOT EXISTS prior_insurance_company_id uuid REFERENCES prior_insurance_companies(id);

CREATE INDEX IF NOT EXISTS idx_sales_prior_insurance_company ON sales(prior_insurance_company_id) WHERE prior_insurance_company_id IS NOT NULL;

COMMENT ON COLUMN sales.prior_insurance_company_id IS 'The insurance company the customer had before this sale.';
