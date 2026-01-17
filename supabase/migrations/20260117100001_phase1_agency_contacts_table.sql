-- Phase 1: Create agency_contacts table
-- Master contact/household table linking records across all modules

CREATE TABLE public.agency_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,

  first_name text NOT NULL,
  last_name text NOT NULL,
  household_key text NOT NULL,

  phones text[] NOT NULL DEFAULT '{}',
  emails text[] NOT NULL DEFAULT '{}',

  street_address text,
  city text,
  state text,
  zip_code text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT agency_contacts_agency_household_unique UNIQUE (agency_id, household_key)
);

CREATE INDEX idx_agency_contacts_phones ON agency_contacts USING GIN (phones);
CREATE INDEX idx_agency_contacts_agency ON agency_contacts(agency_id);
CREATE INDEX idx_agency_contacts_name ON agency_contacts(agency_id, last_name, first_name);

ALTER TABLE agency_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agency_contacts_user_policy" ON agency_contacts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND (p.role = 'admin' OR p.agency_id = agency_contacts.agency_id)
    )
  );

COMMENT ON TABLE agency_contacts IS 'Master contact/household table linking records across all modules';

-- Verification query (run after migration):
-- SELECT table_name, column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'agency_contacts'
-- ORDER BY ordinal_position;
