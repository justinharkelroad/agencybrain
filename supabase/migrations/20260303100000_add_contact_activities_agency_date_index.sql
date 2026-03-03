-- Index for morning digest staff activity breakdown query
-- Existing idx_contact_activities_agency is on (agency_id, created_at), but we query by activity_date
CREATE INDEX IF NOT EXISTS idx_contact_activities_agency_activity_date
ON contact_activities(agency_id, activity_date);
