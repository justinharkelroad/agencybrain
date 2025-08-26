-- Phase 0: Columns and constraints for existing tables
alter table form_links
  add column if not exists expires_at timestamptz;

alter table form_templates
  add column if not exists status text
  check (status in ('draft','published')) default 'draft';

alter table agencies
  add column if not exists slug text unique;

-- backfill agency slugs once from agency name
update agencies
set slug = coalesce(slug, regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g'))
where slug is null;

-- unique indices
create unique index if not exists uidx_templates_agency_slug
  on form_templates(agency_id, slug);

create unique index if not exists uidx_links_token
  on form_links(token);

-- Phase 1: Create new tables
-- 1.1 Form fields (builder-time schema)
create table if not exists form_fields (
  id uuid primary key default gen_random_uuid(),
  form_template_id uuid not null references form_templates(id) on delete cascade,
  key text not null,
  label text not null,
  type text not null,
  required boolean not null default false,
  options_json jsonb default '{}'::jsonb,
  position int not null default 0,
  builtin boolean not null default false
);

-- 1.2 Template settings
alter table form_templates
  add column if not exists settings_json jsonb default '{}'::jsonb;

-- 1.3 Dictionaries for dropdowns (Lead Source, Product, etc.)
create table if not exists dictionaries (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references agencies(id) on delete cascade,
  name text not null,
  unique (agency_id, name)
);

create table if not exists dictionary_options (
  id uuid primary key default gen_random_uuid(),
  dictionary_id uuid not null references dictionaries(id) on delete cascade,
  value text not null,
  active boolean not null default true,
  unique (dictionary_id, value)
);

-- 1.4 Submissions and "last submission wins" model
create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  form_template_id uuid not null references form_templates(id) on delete cascade,
  team_member_id uuid not null references team_members(id),
  submission_date date not null,
  work_date date,
  submitted_at timestamptz not null default now(),
  late boolean not null default false,
  final boolean not null default true,
  supersedes_id uuid references submissions(id),
  superseded_at timestamptz,
  payload_json jsonb not null default '{}'::jsonb
);

create unique index if not exists uidx_final_submission
  on submissions(form_template_id, team_member_id, coalesce(work_date, submission_date))
  where final = true;

-- Now apply RLS after all tables exist
alter table form_links enable row level security;
alter table form_templates enable row level security;  
alter table form_fields enable row level security;

-- Apply RLS policies
drop policy if exists p_links_select on form_links;
create policy p_links_select on form_links for select using (false);

drop policy if exists p_templates_select on form_templates;
create policy p_templates_select on form_templates for select using (false);

drop policy if exists p_fields_select on form_fields;
create policy p_fields_select on form_fields for select using (false);