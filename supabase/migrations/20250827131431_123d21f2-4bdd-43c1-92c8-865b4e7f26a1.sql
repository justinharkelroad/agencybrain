-- Add ring_metrics column to scorecard_rules table
alter table scorecard_rules
  add column if not exists ring_metrics text[];

-- Populate ring_metrics with existing selected_metrics where null
update scorecard_rules
set ring_metrics = coalesce(ring_metrics, selected_metrics)
where ring_metrics is null;

-- Create RPC function to get team metrics for a specific day
create or replace function get_team_metrics_for_day(p_agency uuid, p_role text, p_date date)
returns table (
  team_member_id uuid,
  name text,
  role text,
  date date,
  outbound_calls int,
  talk_minutes int,
  quoted_count int,
  quoted_entity text,
  sold_items int,
  sold_policies int,
  sold_premium_cents int,
  cross_sells_uncovered int,
  mini_reviews int
) language sql stable as $$
  select tm.id, tm.name, tm.role::text, p_date,
         coalesce(md.outbound_calls,0), coalesce(md.talk_minutes,0), coalesce(md.quoted_count,0), md.quoted_entity,
         coalesce(md.sold_items,0), coalesce(md.sold_policies,0), coalesce(md.sold_premium_cents,0),
         coalesce(md.cross_sells_uncovered,0), coalesce(md.mini_reviews,0)
  from team_members tm
  left join metrics_daily md
    on md.team_member_id = tm.id and md.date = p_date
  where tm.agency_id = p_agency
    and tm.role::text = p_role
    and tm.status = 'active'
  order by tm.name asc;
$$;