-- Cancel Audit Module - Phase 1 Foundation

-- Table: cancel_audit_records
CREATE TABLE cancel_audit_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  policy_number TEXT NOT NULL,
  household_key TEXT NOT NULL,
  insured_first_name TEXT,
  insured_last_name TEXT,
  insured_email TEXT,
  insured_phone TEXT,
  insured_phone_alt TEXT,
  agent_number TEXT,
  product_name TEXT,
  premium_cents BIGINT DEFAULT 0,
  no_of_items INTEGER DEFAULT 1,
  account_type TEXT,
  report_type TEXT NOT NULL CHECK (report_type IN ('cancellation', 'pending_cancel')),
  amount_due_cents BIGINT,
  cancel_date DATE,
  renewal_effective_date DATE,
  pending_cancel_date DATE,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'resolved', 'lost')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_upload_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agency_id, policy_number)
);

-- Indexes for cancel_audit_records
CREATE INDEX idx_cancel_audit_records_agency ON cancel_audit_records(agency_id);
CREATE INDEX idx_cancel_audit_records_household ON cancel_audit_records(agency_id, household_key);
CREATE INDEX idx_cancel_audit_records_status ON cancel_audit_records(agency_id, status);
CREATE INDEX idx_cancel_audit_records_report_type ON cancel_audit_records(agency_id, report_type);
CREATE INDEX idx_cancel_audit_records_pending_date ON cancel_audit_records(pending_cancel_date) WHERE pending_cancel_date IS NOT NULL;
CREATE INDEX idx_cancel_audit_records_cancel_date ON cancel_audit_records(cancel_date) WHERE cancel_date IS NOT NULL;

-- Table: cancel_audit_activities
CREATE TABLE cancel_audit_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  record_id UUID NOT NULL REFERENCES cancel_audit_records(id) ON DELETE CASCADE,
  household_key TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  staff_member_id UUID REFERENCES team_members(id),
  user_display_name TEXT NOT NULL,
  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'attempted_call',
    'voicemail_left',
    'text_sent',
    'email_sent',
    'spoke_with_client',
    'payment_made',
    'payment_promised',
    'note'
  )),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for cancel_audit_activities
CREATE INDEX idx_cancel_audit_activities_agency ON cancel_audit_activities(agency_id);
CREATE INDEX idx_cancel_audit_activities_record ON cancel_audit_activities(record_id);
CREATE INDEX idx_cancel_audit_activities_household ON cancel_audit_activities(agency_id, household_key);
CREATE INDEX idx_cancel_audit_activities_created ON cancel_audit_activities(created_at DESC);
CREATE INDEX idx_cancel_audit_activities_week ON cancel_audit_activities(agency_id, created_at);

-- Table: cancel_audit_uploads
CREATE TABLE cancel_audit_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  uploaded_by_user_id UUID REFERENCES auth.users(id),
  uploaded_by_staff_id UUID REFERENCES team_members(id),
  uploaded_by_name TEXT NOT NULL,
  report_type TEXT NOT NULL CHECK (report_type IN ('cancellation', 'pending_cancel')),
  file_name TEXT,
  records_processed INTEGER NOT NULL DEFAULT 0,
  records_created INTEGER NOT NULL DEFAULT 0,
  records_updated INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cancel_audit_uploads_agency ON cancel_audit_uploads(agency_id);

-- Enable RLS
ALTER TABLE cancel_audit_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE cancel_audit_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE cancel_audit_uploads ENABLE ROW LEVEL SECURITY;

-- Helper function to check cancel audit access (supports both auth methods)
CREATE OR REPLACE FUNCTION has_cancel_audit_access(check_agency_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_session_agency_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  -- Check for staff portal session first (stored in user metadata)
  SELECT 
    (raw_user_meta_data->>'staff_agency_id')::UUID 
  INTO v_session_agency_id
  FROM auth.users 
  WHERE id = v_user_id;
  
  -- If staff portal session, check agency match
  IF v_session_agency_id IS NOT NULL THEN
    RETURN v_session_agency_id = check_agency_id;
  END IF;
  
  -- Otherwise check regular profile
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = v_user_id
    AND agency_id = check_agency_id
  );
END;
$$;

-- Policies for cancel_audit_records
CREATE POLICY "Users can view their agency cancel audit records"
  ON cancel_audit_records FOR SELECT
  USING (has_cancel_audit_access(agency_id));

CREATE POLICY "Users can insert cancel audit records for their agency"
  ON cancel_audit_records FOR INSERT
  WITH CHECK (has_cancel_audit_access(agency_id));

CREATE POLICY "Users can update their agency cancel audit records"
  ON cancel_audit_records FOR UPDATE
  USING (has_cancel_audit_access(agency_id));

-- Policies for cancel_audit_activities
CREATE POLICY "Users can view their agency cancel audit activities"
  ON cancel_audit_activities FOR SELECT
  USING (has_cancel_audit_access(agency_id));

CREATE POLICY "Users can insert activities for their agency"
  ON cancel_audit_activities FOR INSERT
  WITH CHECK (has_cancel_audit_access(agency_id));

-- Policies for cancel_audit_uploads
CREATE POLICY "Users can view their agency upload history"
  ON cancel_audit_uploads FOR SELECT
  USING (has_cancel_audit_access(agency_id));

CREATE POLICY "Users can insert uploads for their agency"
  ON cancel_audit_uploads FOR INSERT
  WITH CHECK (has_cancel_audit_access(agency_id));

-- Updated_at Trigger
CREATE OR REPLACE FUNCTION update_cancel_audit_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trigger_cancel_audit_records_updated_at
  BEFORE UPDATE ON cancel_audit_records
  FOR EACH ROW
  EXECUTE FUNCTION update_cancel_audit_records_updated_at();