-- Create/update view for metrics with team member names (fix column references)
CREATE OR REPLACE VIEW public.vw_metrics_with_team AS
SELECT md.*,
       COALESCE(tm.name, 'Unassigned') AS rep_name
FROM public.metrics_daily md
LEFT JOIN public.team_members tm
  ON tm.id = md.team_member_id
 AND tm.agency_id = md.agency_id;