-- Phase 3: Add contact_id to existing tables
-- Links existing module tables to the unified agency_contacts table

ALTER TABLE lqs_households ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES agency_contacts(id);
ALTER TABLE cancel_audit_records ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES agency_contacts(id);
ALTER TABLE renewal_records ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES agency_contacts(id);
ALTER TABLE winback_households ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES agency_contacts(id);

CREATE INDEX IF NOT EXISTS idx_lqs_households_contact ON lqs_households(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cancel_audit_contact ON cancel_audit_records(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_renewal_contact ON renewal_records(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_winback_contact ON winback_households(contact_id) WHERE contact_id IS NOT NULL;

-- Verification query (run after migration):
-- SELECT
--   'lqs_households' as tbl, column_name FROM information_schema.columns WHERE table_name = 'lqs_households' AND column_name = 'contact_id'
-- UNION ALL
-- SELECT
--   'cancel_audit_records', column_name FROM information_schema.columns WHERE table_name = 'cancel_audit_records' AND column_name = 'contact_id'
-- UNION ALL
-- SELECT
--   'renewal_records', column_name FROM information_schema.columns WHERE table_name = 'renewal_records' AND column_name = 'contact_id'
-- UNION ALL
-- SELECT
--   'winback_households', column_name FROM information_schema.columns WHERE table_name = 'winback_households' AND column_name = 'contact_id';
-- Should return 4 rows.
