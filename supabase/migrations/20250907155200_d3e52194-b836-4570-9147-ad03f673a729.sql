-- Phase 0: Additive database schema changes and RLS setup

-- Enable extensions if not present
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1) Lead source cost tracking (centralized in Settings)
ALTER TABLE lead_sources
  ADD COLUMN IF NOT EXISTS cost_per_lead_cents INTEGER NOT NULL DEFAULT 0;

-- 2) Prospect overrides (edit layer; never mutate raw submission rows)
CREATE TABLE IF NOT EXISTS prospect_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id),
  quoted_household_detail_id UUID NOT NULL REFERENCES quoted_household_details(id) ON DELETE CASCADE,
  prospect_name TEXT,
  email TEXT,
  phone TEXT,
  notes TEXT,
  zip TEXT,
  lead_source_id UUID REFERENCES lead_sources(id),
  lead_source_raw TEXT,                 -- keep original text if present in submission
  items_quoted INT,
  policies_quoted INT,
  premium_potential_cents BIGINT,       -- default handled in app as 0
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (agency_id, quoted_household_detail_id)
);

CREATE INDEX IF NOT EXISTS idx_prospect_overrides_agency_detail
  ON prospect_overrides (agency_id, quoted_household_detail_id);

-- 3) Per‑user custom fields (owner scoped; appear only for that user)
-- Types restricted to 'short_text' and 'long_text'
CREATE TABLE IF NOT EXISTS prospect_custom_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id),
  owner_user_id UUID NOT NULL,                      -- auth.uid()
  field_key TEXT NOT NULL,                          -- stable key
  field_label TEXT NOT NULL,                        -- display label
  field_type TEXT NOT NULL CHECK (field_type IN ('short_text','long_text')),
  order_index INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id, field_key)
);

CREATE TABLE IF NOT EXISTS prospect_custom_field_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id),
  owner_user_id UUID NOT NULL,                      -- auth.uid()
  quoted_household_detail_id UUID NOT NULL REFERENCES quoted_household_details(id) ON DELETE CASCADE,
  field_id UUID NOT NULL REFERENCES prospect_custom_fields(id) ON DELETE CASCADE,
  value_text TEXT,                                  -- stores both short/long
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id, quoted_household_detail_id, field_id)
);

CREATE INDEX IF NOT EXISTS idx_pcfv_user_detail ON prospect_custom_field_values (owner_user_id, quoted_household_detail_id);

-- 4) Optional derived columns on details (if not already present)
ALTER TABLE quoted_household_details
  ADD COLUMN IF NOT EXISTS items_quoted INT,
  ADD COLUMN IF NOT EXISTS policies_quoted INT,
  ADD COLUMN IF NOT EXISTS premium_potential_cents BIGINT;

-- 5) RLS scaffolding
ALTER TABLE prospect_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospect_custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospect_custom_field_values ENABLE ROW LEVEL SECURITY;

-- Agency members can manage overrides in their own agency
CREATE POLICY prospect_overrides_agency_access ON prospect_overrides
  FOR ALL USING (has_agency_access(auth.uid(), agency_id))
  WITH CHECK (has_agency_access(auth.uid(), agency_id));

-- Custom fields and values are per-user and agency constrained  
CREATE POLICY prospect_custom_fields_owner_access ON prospect_custom_fields
  FOR ALL USING (owner_user_id = auth.uid() AND has_agency_access(auth.uid(), agency_id))
  WITH CHECK (owner_user_id = auth.uid() AND has_agency_access(auth.uid(), agency_id));

CREATE POLICY prospect_custom_field_values_owner_access ON prospect_custom_field_values
  FOR ALL USING (owner_user_id = auth.uid() AND has_agency_access(auth.uid(), agency_id))
  WITH CHECK (owner_user_id = auth.uid() AND has_agency_access(auth.uid(), agency_id));