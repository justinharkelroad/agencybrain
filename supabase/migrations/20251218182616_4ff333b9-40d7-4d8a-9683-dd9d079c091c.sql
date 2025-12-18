-- Create meeting_frames table
CREATE TABLE public.meeting_frames (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  kpi_totals JSONB DEFAULT '{}',
  call_log_data JSONB DEFAULT '{}',
  quoted_data JSONB DEFAULT '{}',
  sold_data JSONB DEFAULT '{}',
  call_scoring_data JSONB DEFAULT '[]',
  meeting_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for fast lookups
CREATE INDEX idx_meeting_frames_agency ON meeting_frames(agency_id);
CREATE INDEX idx_meeting_frames_team_member ON meeting_frames(team_member_id);

-- Enable RLS
ALTER TABLE meeting_frames ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view meeting frames for their agency"
ON meeting_frames FOR SELECT TO authenticated
USING (agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can create meeting frames for their agency"
ON meeting_frames FOR INSERT TO authenticated
WITH CHECK (agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete their own meeting frames"
ON meeting_frames FOR DELETE TO authenticated
USING (created_by = auth.uid());