-- Coaching insight threshold settings per agency
CREATE TABLE coaching_insight_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  thresholds jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coaching_insight_settings_agency_unique UNIQUE (agency_id)
);

ALTER TABLE coaching_insight_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own agency coaching settings"
  ON coaching_insight_settings FOR ALL
  USING (has_agency_access(auth.uid(), agency_id));
