-- VOIP Integration Tables for RingCentral (and future Ricochet)
-- Note: contact_activities table already exists from phase2 migration (20260117100002)
--       Call events will link to existing contact_activities via call_event_id column

-- Agency-level VOIP provider configurations
CREATE TABLE IF NOT EXISTS voip_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('ringcentral', 'ricochet')),

  -- OAuth tokens (encrypted at rest by Supabase)
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,

  -- RingCentral-specific
  rc_account_id TEXT,

  -- Ricochet-specific (for future)
  external_account_id TEXT,
  webhook_secret TEXT,

  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  last_sync_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(agency_id, provider)
);

-- Incoming call events from any provider
CREATE TABLE IF NOT EXISTS call_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  voip_integration_id UUID REFERENCES voip_integrations(id) ON DELETE SET NULL,

  external_call_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('ringcentral', 'ricochet')),

  direction TEXT CHECK (direction IN ('Inbound', 'Outbound')),
  call_type TEXT,

  from_number TEXT,
  to_number TEXT,

  call_started_at TIMESTAMPTZ,
  call_ended_at TIMESTAMPTZ,
  duration_seconds INTEGER DEFAULT 0,

  result TEXT,

  extension_id TEXT,
  extension_name TEXT,

  matched_team_member_id UUID REFERENCES team_members(id) ON DELETE SET NULL,
  matched_prospect_id UUID REFERENCES quoted_household_details(id) ON DELETE SET NULL,

  raw_payload JSONB,

  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(provider, external_call_id)
);

-- Daily aggregated call metrics per team member
CREATE TABLE IF NOT EXISTS call_metrics_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  team_member_id UUID REFERENCES team_members(id) ON DELETE CASCADE,
  date DATE NOT NULL,

  total_calls INTEGER DEFAULT 0,
  inbound_calls INTEGER DEFAULT 0,
  outbound_calls INTEGER DEFAULT 0,
  answered_calls INTEGER DEFAULT 0,
  missed_calls INTEGER DEFAULT 0,
  total_talk_seconds INTEGER DEFAULT 0,

  last_calculated_at TIMESTAMPTZ DEFAULT now(),

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(agency_id, team_member_id, date)
);

-- Indexes for new tables
CREATE INDEX IF NOT EXISTS idx_voip_integrations_agency ON voip_integrations(agency_id);
CREATE INDEX IF NOT EXISTS idx_call_events_agency ON call_events(agency_id);
CREATE INDEX IF NOT EXISTS idx_call_events_started ON call_events(call_started_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_events_from ON call_events(from_number);
CREATE INDEX IF NOT EXISTS idx_call_events_to ON call_events(to_number);
CREATE INDEX IF NOT EXISTS idx_call_metrics_daily_lookup ON call_metrics_daily(agency_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_call_metrics_daily_member ON call_metrics_daily(team_member_id, date DESC);

-- RLS Policies for new tables
ALTER TABLE voip_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_metrics_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agency members view voip_integrations"
  ON voip_integrations FOR SELECT
  USING (agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Agency owners manage voip_integrations"
  ON voip_integrations FOR ALL
  USING (agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'admin')));

CREATE POLICY "Agency members view call_events"
  ON call_events FOR SELECT
  USING (agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Agency members view call_metrics_daily"
  ON call_metrics_daily FOR SELECT
  USING (agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid()));

-- Add call_event_id column to existing contact_activities table to link VOIP calls
ALTER TABLE contact_activities ADD COLUMN IF NOT EXISTS call_event_id UUID REFERENCES call_events(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_contact_activities_call_event ON contact_activities(call_event_id) WHERE call_event_id IS NOT NULL;
