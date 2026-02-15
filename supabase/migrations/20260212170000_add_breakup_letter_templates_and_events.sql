create table if not exists public.breakup_letter_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  letter_template text not null,
  email_template text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id) on delete set null
);

create table if not exists public.breakup_letter_generation_events (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  contact_id uuid null references public.agency_contacts(id) on delete set null,
  customer_name text null,
  source_context text not null default 'unknown',
  carrier_count integer not null default 0,
  policy_count integer not null default 0,
  generated_by_user_id uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.breakup_letter_templates enable row level security;
alter table public.breakup_letter_generation_events enable row level security;

drop policy if exists "Authenticated users can view breakup letter templates" on public.breakup_letter_templates;
create policy "Authenticated users can view breakup letter templates"
on public.breakup_letter_templates
for select
to authenticated
using (true);

drop policy if exists "Admins can manage breakup letter templates" on public.breakup_letter_templates;
create policy "Admins can manage breakup letter templates"
on public.breakup_letter_templates
for all
to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'admin'
  )
);

drop policy if exists "Agency users can view breakup letter generation events" on public.breakup_letter_generation_events;
create policy "Agency users can view breakup letter generation events"
on public.breakup_letter_generation_events
for select
to authenticated
using (public.has_agency_access(auth.uid(), agency_id));

drop policy if exists "Agency users can insert breakup letter generation events" on public.breakup_letter_generation_events;
create policy "Agency users can insert breakup letter generation events"
on public.breakup_letter_generation_events
for insert
to authenticated
with check (
  public.has_agency_access(auth.uid(), agency_id)
  and generated_by_user_id = auth.uid()
);

insert into public.breakup_letter_templates (name, letter_template, email_template, is_active)
values (
  'global_default',
  'Please accept this as my written request to cancel my current policy(ies) with your company. I have obtained insurance with another insurance company as of the cancellation date(s) listed below.

Policy details:
{{policy_lines}}

Prior Agent/Agency Name: {{prior_agent_agency_name}}

Please return all unearned policy premium to the address listed below and discontinue any future automatic withdrawals for my account.
Please email back confirming receipt of this cancellation request.
If you need additional information, you may contact my new agent {{primary_agent_name}}.
I am also approving the release of information regarding my insurance policies to {{agency_display_name}}.',
  'Subject: Cancellation Request Letter Attached

Hi {{customer_first_name}},
Attached is your cancellation request letter for {{carrier_name}}.
Please sign and date the letter, then submit it to your prior carrier.
Once submitted, please reply to this email with the carrier''s confirmation of cancellation.
If you run into any issues, reply here and we''ll help.

Thanks,
{{agency_display_name}}',
  true
)
on conflict (name) do nothing;
