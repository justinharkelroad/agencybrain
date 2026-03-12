-- Create brokered_carrier_policy_types table
-- Each brokered carrier can have predefined policy types for dropdown selection

CREATE TABLE brokered_carrier_policy_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brokered_carrier_id uuid NOT NULL REFERENCES brokered_carriers(id) ON DELETE CASCADE,
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(brokered_carrier_id, name)
);

-- RLS
ALTER TABLE brokered_carrier_policy_types ENABLE ROW LEVEL SECURITY;

-- Public SELECT (mirrors brokered_carriers — staff users need access)
CREATE POLICY "Anyone can view brokered carrier policy types"
  ON brokered_carrier_policy_types FOR SELECT
  USING (true);

-- INSERT/UPDATE/DELETE via has_agency_access
CREATE POLICY "Agency members can insert brokered carrier policy types"
  ON brokered_carrier_policy_types FOR INSERT
  WITH CHECK (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Agency members can update brokered carrier policy types"
  ON brokered_carrier_policy_types FOR UPDATE
  USING (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Agency members can delete brokered carrier policy types"
  ON brokered_carrier_policy_types FOR DELETE
  USING (has_agency_access(auth.uid(), agency_id));

-- updated_at trigger
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'update_updated_at_column'
  ) THEN
    CREATE TRIGGER update_brokered_carrier_policy_types_updated_at
      BEFORE UPDATE ON brokered_carrier_policy_types
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Add brokered_carrier_id to lqs_quotes
ALTER TABLE lqs_quotes
  ADD COLUMN brokered_carrier_id uuid REFERENCES brokered_carriers(id);

CREATE INDEX idx_lqs_quotes_brokered_carrier
  ON lqs_quotes(brokered_carrier_id)
  WHERE brokered_carrier_id IS NOT NULL;
