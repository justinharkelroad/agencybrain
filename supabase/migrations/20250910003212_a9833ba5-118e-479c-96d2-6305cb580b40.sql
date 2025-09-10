-- Add performance indices for dashboard queries
CREATE INDEX IF NOT EXISTS idx_md_agency_date ON metrics_daily(agency_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_binds_form ON forms_kpi_bindings(form_template_id);
CREATE INDEX IF NOT EXISTS idx_kpi_versions_kpi_valid ON kpi_versions(kpi_id) WHERE valid_to IS NULL;
CREATE INDEX IF NOT EXISTS idx_submissions_member_date ON submissions(team_member_id, work_date DESC NULLS LAST, submission_date DESC);
CREATE INDEX IF NOT EXISTS idx_team_members_agency_role ON team_members(agency_id, role) WHERE status = 'active';