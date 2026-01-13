-- Win-Back HQ - Phase 1: Database Foundation
-- Creates tables for tracking terminated policies and win-back opportunities

-- ============================================
-- Table 1: winback_settings
-- Agency-level settings for win-back contact timing
-- ============================================
CREATE TABLE winback_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  contact_days_before INTEGER NOT NULL DEFAULT 45,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agency_id)
);

COMMENT ON TABLE winback_settings IS 'Agency-level settings for win-back contact timing';
COMMENT ON COLUMN winback_settings.contact_days_before IS 'Number of days before competitor renewal to surface the lead (default 45)';

-- ============================================
-- Table 2: winback_households
-- Consolidated customer/household records for win-back tracking
-- ============================================
CREATE TABLE winback_households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  street_address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'untouched' CHECK (status IN ('untouched', 'in_progress', 'won_back', 'declined', 'no_contact', 'dismissed')),
  assigned_to UUID REFERENCES team_members(id) ON DELETE SET NULL,
  notes TEXT,
  earliest_winback_date DATE,
  total_premium_potential_cents BIGINT DEFAULT 0,
  policy_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint: one household per name+zip per agency
CREATE UNIQUE INDEX winback_households_unique_idx 
  ON winback_households(agency_id, LOWER(TRIM(first_name)), LOWER(TRIM(last_name)), SUBSTRING(zip_code FROM 1 FOR 5));

-- Performance indexes
CREATE INDEX winback_households_agency_status_idx ON winback_households(agency_id, status);
CREATE INDEX winback_households_winback_date_idx ON winback_households(agency_id, earliest_winback_date);
CREATE INDEX winback_households_assigned_idx ON winback_households(assigned_to) WHERE assigned_to IS NOT NULL;

COMMENT ON TABLE winback_households IS 'Consolidated customer/household records for win-back tracking';
COMMENT ON COLUMN winback_households.earliest_winback_date IS 'Earliest calculated contact date across all policies';
COMMENT ON COLUMN winback_households.total_premium_potential_cents IS 'Sum of premium_new across all policies in cents';

-- ============================================
-- Table 3: winback_policies
-- Individual terminated policies linked to households
-- ============================================
CREATE TABLE winback_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES winback_households(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  policy_number TEXT NOT NULL,
  agent_number TEXT,
  original_year INTEGER,
  product_code TEXT,
  product_name TEXT NOT NULL,
  policy_term_months INTEGER NOT NULL DEFAULT 6,
  renewal_effective_date DATE,
  anniversary_effective_date DATE,
  termination_effective_date DATE NOT NULL,
  termination_reason TEXT,
  termination_type TEXT,
  premium_new_cents BIGINT,
  premium_old_cents BIGINT,
  premium_change_cents BIGINT,
  premium_change_percent NUMERIC(5,2),
  account_type TEXT,
  company_code TEXT,
  is_cancel_rewrite BOOLEAN NOT NULL DEFAULT false,
  calculated_winback_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(agency_id, policy_number)
);

-- Performance indexes
CREATE INDEX winback_policies_household_idx ON winback_policies(household_id);
CREATE INDEX winback_policies_agency_idx ON winback_policies(agency_id);
CREATE INDEX winback_policies_winback_date_idx ON winback_policies(calculated_winback_date);
CREATE INDEX winback_policies_termination_date_idx ON winback_policies(termination_effective_date);
CREATE INDEX winback_policies_cancel_rewrite_idx ON winback_policies(agency_id, is_cancel_rewrite) WHERE is_cancel_rewrite = true;

COMMENT ON TABLE winback_policies IS 'Individual terminated policies linked to households';
COMMENT ON COLUMN winback_policies.policy_term_months IS '6 for auto policies, 12 for property/umbrella';
COMMENT ON COLUMN winback_policies.calculated_winback_date IS 'termination_date + policy_term - contact_days_before';
COMMENT ON COLUMN winback_policies.is_cancel_rewrite IS 'True if termination reason contains Cancel/Rewrite';

-- ============================================
-- Table 4: winback_uploads
-- Tracks termination audit file uploads for audit trail
-- ============================================
CREATE TABLE winback_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  uploaded_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  uploaded_by_staff_id UUID REFERENCES staff_users(id) ON DELETE SET NULL,
  filename TEXT NOT NULL,
  records_processed INTEGER NOT NULL DEFAULT 0,
  records_new_households INTEGER NOT NULL DEFAULT 0,
  records_new_policies INTEGER NOT NULL DEFAULT 0,
  records_updated INTEGER NOT NULL DEFAULT 0,
  records_skipped INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX winback_uploads_agency_idx ON winback_uploads(agency_id, created_at DESC);

COMMENT ON TABLE winback_uploads IS 'Tracks termination audit file uploads for audit trail';

-- ============================================
-- Row Level Security
-- ============================================

-- Enable RLS on all tables
ALTER TABLE winback_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE winback_households ENABLE ROW LEVEL SECURITY;
ALTER TABLE winback_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE winback_uploads ENABLE ROW LEVEL SECURITY;

-- winback_settings policies
CREATE POLICY "Users can view their agency winback settings" ON winback_settings
  FOR SELECT USING (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Users can insert their agency winback settings" ON winback_settings
  FOR INSERT WITH CHECK (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Users can update their agency winback settings" ON winback_settings
  FOR UPDATE USING (has_agency_access(auth.uid(), agency_id));

-- winback_households policies
CREATE POLICY "Users can view their agency winback households" ON winback_households
  FOR SELECT USING (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Users can insert their agency winback households" ON winback_households
  FOR INSERT WITH CHECK (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Users can update their agency winback households" ON winback_households
  FOR UPDATE USING (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Users can delete their agency winback households" ON winback_households
  FOR DELETE USING (has_agency_access(auth.uid(), agency_id));

-- winback_policies policies
CREATE POLICY "Users can view their agency winback policies" ON winback_policies
  FOR SELECT USING (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Users can insert their agency winback policies" ON winback_policies
  FOR INSERT WITH CHECK (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Users can update their agency winback policies" ON winback_policies
  FOR UPDATE USING (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Users can delete their agency winback policies" ON winback_policies
  FOR DELETE USING (has_agency_access(auth.uid(), agency_id));

-- winback_uploads policies
CREATE POLICY "Users can view their agency winback uploads" ON winback_uploads
  FOR SELECT USING (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Users can insert their agency winback uploads" ON winback_uploads
  FOR INSERT WITH CHECK (has_agency_access(auth.uid(), agency_id));

-- ============================================
-- Triggers for updated_at
-- ============================================

CREATE TRIGGER update_winback_settings_updated_at
  BEFORE UPDATE ON winback_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_winback_households_updated_at
  BEFORE UPDATE ON winback_households
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_winback_policies_updated_at
  BEFORE UPDATE ON winback_policies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Helper function to recalculate household aggregates
-- ============================================
CREATE OR REPLACE FUNCTION recalculate_winback_household_aggregates(p_household_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE winback_households h
  SET 
    earliest_winback_date = (
      SELECT MIN(calculated_winback_date)
      FROM winback_policies p
      WHERE p.household_id = h.id
        AND NOT p.is_cancel_rewrite
    ),
    total_premium_potential_cents = (
      SELECT COALESCE(SUM(premium_new_cents), 0)
      FROM winback_policies p
      WHERE p.household_id = h.id
    ),
    policy_count = (
      SELECT COUNT(*)
      FROM winback_policies p
      WHERE p.household_id = h.id
    ),
    updated_at = now()
  WHERE h.id = p_household_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;