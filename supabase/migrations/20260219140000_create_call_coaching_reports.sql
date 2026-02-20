-- Create call_coaching_reports table for Compare & Coach feature
-- Stores AI-generated coaching reports comparing 2-5 scored calls

CREATE TABLE IF NOT EXISTS call_coaching_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_staff_id UUID REFERENCES staff_users(id) ON DELETE SET NULL,
  CONSTRAINT must_have_creator CHECK (
    created_by_user_id IS NOT NULL OR created_by_staff_id IS NOT NULL
  ),
  call_ids UUID[] NOT NULL,
  comparison_mode TEXT NOT NULL DEFAULT 'trajectory'
    CHECK (comparison_mode IN ('trajectory', 'peer')),
  custom_prompt TEXT,
  title TEXT NOT NULL,
  report_data JSONB NOT NULL,
  model_used TEXT,
  input_tokens INT,
  output_tokens INT,
  gpt_cost NUMERIC(10,6),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Composite index covers both equality lookups on agency_id and ORDER BY created_at DESC
CREATE INDEX idx_coaching_reports_agency_created ON call_coaching_reports(agency_id, created_at DESC);

-- RLS
ALTER TABLE call_coaching_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coaching_reports_select"
  ON call_coaching_reports FOR SELECT
  USING (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "coaching_reports_insert"
  ON call_coaching_reports FOR INSERT
  WITH CHECK (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "coaching_reports_update"
  ON call_coaching_reports FOR UPDATE
  USING (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "coaching_reports_delete"
  ON call_coaching_reports FOR DELETE
  USING (has_agency_access(auth.uid(), agency_id));

-- Grant access to authenticated and anon (staff use service role via edge functions)
GRANT SELECT, INSERT, UPDATE, DELETE ON call_coaching_reports TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON call_coaching_reports TO anon;
