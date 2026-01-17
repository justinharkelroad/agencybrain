-- Phase 2: Create contact_activities table
-- Unified activity timeline across all modules and phone system

CREATE TABLE public.contact_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES agency_contacts(id) ON DELETE CASCADE,

  source_module text NOT NULL CHECK (source_module IN ('lqs', 'cancel_audit', 'renewal', 'winback', 'phone_system', 'manual')),
  source_record_id uuid,

  activity_type text NOT NULL,
  activity_subtype text,

  phone_number text,
  call_direction text CHECK (call_direction IN ('inbound', 'outbound')),
  call_duration_seconds integer,
  call_recording_url text,

  subject text,
  notes text,
  outcome text,

  created_by_user_id uuid REFERENCES auth.users(id),
  created_by_staff_id uuid REFERENCES staff_users(id),
  created_by_display_name text,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_contact_activities_contact ON contact_activities(contact_id, created_at DESC);
CREATE INDEX idx_contact_activities_agency ON contact_activities(agency_id, created_at DESC);
CREATE INDEX idx_contact_activities_phone ON contact_activities(phone_number) WHERE phone_number IS NOT NULL;
CREATE INDEX idx_contact_activities_source ON contact_activities(source_module, source_record_id);

ALTER TABLE contact_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contact_activities_user_policy" ON contact_activities
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND (p.role = 'admin' OR p.agency_id = contact_activities.agency_id)
    )
  );

COMMENT ON TABLE contact_activities IS 'Unified activity timeline across all modules and phone system';

-- Verification query (run after migration):
-- SELECT table_name, column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'contact_activities'
-- ORDER BY ordinal_position;
