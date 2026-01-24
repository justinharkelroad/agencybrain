-- Migration: Create winback_activities table
-- Date: 2026-01-22
-- Issue: Table was missing from initial winback migration, causing:
--   - Activity logging to fail
--   - Quoted button flow to break
--   - Stats components to show empty data
--   - Realtime subscriptions to fail

-- ============================================
-- Table: winback_activities
-- Tracks all activities performed on winback households
-- ============================================
CREATE TABLE IF NOT EXISTS winback_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES winback_households(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  notes TEXT,
  created_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_by_team_member_id UUID REFERENCES team_members(id) ON DELETE SET NULL,
  created_by_name TEXT,
  old_status TEXT,
  new_status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Constraint: Valid activity types
-- ============================================
ALTER TABLE winback_activities
ADD CONSTRAINT winback_activities_activity_type_check
CHECK (activity_type = ANY (ARRAY[
  'called'::text,
  'left_vm'::text,
  'texted'::text,
  'emailed'::text,
  'quoted'::text,
  'note'::text,
  'status_change'::text,
  'won_back'::text
]));

-- ============================================
-- Indexes for common queries
-- ============================================
CREATE INDEX idx_winback_activities_household_id ON winback_activities(household_id);
CREATE INDEX idx_winback_activities_agency_id ON winback_activities(agency_id);
CREATE INDEX idx_winback_activities_created_at ON winback_activities(created_at DESC);
CREATE INDEX idx_winback_activities_activity_type ON winback_activities(activity_type);
CREATE INDEX idx_winback_activities_agency_created ON winback_activities(agency_id, created_at DESC);

-- ============================================
-- RLS Policies for agency isolation
-- ============================================
ALTER TABLE winback_activities ENABLE ROW LEVEL SECURITY;

-- Select: Users can view activities for their agency
CREATE POLICY winback_activities_select_policy ON winback_activities
  FOR SELECT
  USING (has_agency_access(auth.uid(), agency_id));

-- Insert: Users can create activities for their agency
CREATE POLICY winback_activities_insert_policy ON winback_activities
  FOR INSERT
  WITH CHECK (has_agency_access(auth.uid(), agency_id));

-- Update: Users can update activities for their agency
CREATE POLICY winback_activities_update_policy ON winback_activities
  FOR UPDATE
  USING (has_agency_access(auth.uid(), agency_id));

-- Delete: Users can delete activities for their agency
CREATE POLICY winback_activities_delete_policy ON winback_activities
  FOR DELETE
  USING (has_agency_access(auth.uid(), agency_id));

-- ============================================
-- Add to Supabase Realtime publication
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE winback_activities;

-- ============================================
-- Grant permissions
-- ============================================
GRANT SELECT, INSERT, UPDATE, DELETE ON winback_activities TO authenticated;
