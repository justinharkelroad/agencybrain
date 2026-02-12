alter table public.agencies
add column if not exists breakup_letter_agency_display_name text,
add column if not exists breakup_letter_primary_agent_name text,
add column if not exists breakup_letter_primary_agent_phone text,
add column if not exists breakup_letter_confirmation_reply_email text;
