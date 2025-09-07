-- Add missing foreign key constraint for quoted_household_details -> lead_sources
-- This is the actual missing relationship causing the Explorer 500 error
ALTER TABLE quoted_household_details
  ADD CONSTRAINT qhd_lead_source_fk
  FOREIGN KEY (lead_source_id) REFERENCES lead_sources(id);

-- Reload PostgREST schema cache to pick up new relationship
SELECT pg_notify('pgrst', 'reload schema');