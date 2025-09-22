-- 1) Create view to join metrics and team members (fixed column names)
CREATE OR REPLACE VIEW public.vw_metrics_with_team AS
SELECT
  md.*,
  COALESCE(tm.name, 'Unassigned') AS rep_name
FROM public.metrics_daily md
LEFT JOIN public.team_members tm
  ON tm.id = md.team_member_id
  AND tm.agency_id = md.agency_id;

-- 2) Create index for efficient daily queries
CREATE INDEX IF NOT EXISTS idx_metrics_daily_agency_date
  ON public.metrics_daily(agency_id, date DESC);

-- 3) Create daily dashboard function
CREATE OR REPLACE FUNCTION public.get_dashboard_daily(
  p_agency_id uuid,
  p_work_date date
)
RETURNS TABLE(
  team_member_id uuid,
  rep_name text,
  work_date date,
  outbound_calls integer,
  talk_minutes integer,
  quoted_count integer,
  sold_items integer,
  sold_policies integer,
  sold_premium_cents bigint,
  cross_sells_uncovered integer,
  mini_reviews integer,
  pass boolean,
  hits integer,
  daily_score integer,
  is_late boolean,
  status text
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT 
    vw.team_member_id,
    vw.rep_name,
    vw.date as work_date,
    vw.outbound_calls,
    vw.talk_minutes,
    vw.quoted_count,
    vw.sold_items,
    vw.sold_policies,
    vw.sold_premium_cents,
    vw.cross_sells_uncovered,
    vw.mini_reviews,
    vw.pass,
    vw.hits,
    vw.daily_score,
    vw.is_late,
    'final'::text as status
  FROM public.vw_metrics_with_team vw
  WHERE vw.agency_id = p_agency_id
    AND vw.date = p_work_date
  ORDER BY vw.rep_name NULLS LAST;
$function$;