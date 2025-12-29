-- Create table to store bonus forecast calculator inputs per agency
CREATE TABLE bonus_forecast_inputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  inputs_json JSONB NOT NULL DEFAULT '{}',
  updated_by UUID REFERENCES auth.users(id),
  updated_by_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- One record per agency
CREATE UNIQUE INDEX bonus_forecast_inputs_agency_unique ON bonus_forecast_inputs(agency_id);

-- Enable RLS
ALTER TABLE bonus_forecast_inputs ENABLE ROW LEVEL SECURITY;

-- Agency members can view their agency's forecast inputs
CREATE POLICY "Users can view own agency forecast inputs"
  ON bonus_forecast_inputs FOR SELECT
  USING (has_agency_access(auth.uid(), agency_id));

-- Agency members can insert their agency's forecast inputs
CREATE POLICY "Users can insert own agency forecast inputs"
  ON bonus_forecast_inputs FOR INSERT
  WITH CHECK (has_agency_access(auth.uid(), agency_id));

-- Agency members can update their agency's forecast inputs
CREATE POLICY "Users can update own agency forecast inputs"
  ON bonus_forecast_inputs FOR UPDATE
  USING (has_agency_access(auth.uid(), agency_id));