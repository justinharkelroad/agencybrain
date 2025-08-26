-- Phase 3: Email system with due-by detection, reminders, and rollups

-- 1.1 Update agencies table - already has timezone, reminder_times_json, owner_rollup_time, cc_owner_on_reminders, suppress_if_final_exists

-- 1.2 Create email_outbox table for dedup + auditing of sends
CREATE TABLE IF NOT EXISTS email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('receipt','reminder_same_day','reminder_next_day','owner_rollup')),
  to_email text NOT NULL,
  cc_owner boolean NOT NULL DEFAULT false,
  subject text NOT NULL,
  body_text text NOT NULL,
  body_html text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb, -- {submissionId?, teamMemberId?, workDate?, formId?}
  scheduled_at timestamptz NOT NULL,
  sent_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_outbox_sched ON email_outbox(agency_id, scheduled_at, kind);
CREATE INDEX IF NOT EXISTS idx_email_outbox_sent ON email_outbox(sent_at);

-- Enable RLS on email_outbox
ALTER TABLE email_outbox ENABLE ROW LEVEL SECURITY;

-- Only admins and service role can access email_outbox
CREATE POLICY "Admins can manage all email outbox" ON email_outbox
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 1.3 Helper: compute 'late' using due-by and agency timezone
CREATE OR REPLACE FUNCTION compute_is_late(
  p_agency_id uuid,
  p_settings jsonb,            -- form_templates.settings_json
  p_submission_date date,
  p_work_date date,
  p_submitted_at timestamptz
) RETURNS boolean
LANGUAGE plpgsql STABLE AS $$
DECLARE
  tz text;
  mode text;
  t text;
  off_minutes int;
  base_date date;
  due_ts timestamptz;
BEGIN
  SELECT timezone INTO tz FROM agencies WHERE id = p_agency_id;
  mode := COALESCE(p_settings->'dueBy'->>'mode','same_day');
  t := COALESCE(p_settings->'dueBy'->>'time','23:59');
  off_minutes := COALESCE((p_settings->'dueBy'->>'minutes')::int, 0);
  base_date := COALESCE(p_work_date, p_submission_date);
  
  IF mode = 'same_day' THEN
    due_ts := timezone(tz, (base_date::text || ' ' || t)::timestamptz AT TIME ZONE tz);
  ELSIF mode = 'next_day' THEN
    due_ts := timezone(tz, ((base_date + 1)::text || ' ' || t)::timestamptz AT TIME ZONE tz);
  ELSE
    due_ts := timezone(tz, (base_date::timestamptz AT TIME ZONE tz) + make_interval(mins => off_minutes));
  END IF;
  
  RETURN p_submitted_at > due_ts;
END;
$$;

-- 1.4 Helper: Agency-local 'today' and 'yesterday'
CREATE OR REPLACE FUNCTION get_agency_dates_now(p_agency_id uuid)
RETURNS json 
LANGUAGE plpgsql STABLE AS $$
DECLARE 
  tz text; 
  now_local timestamp; 
  today date; 
  yest date;
BEGIN
  SELECT timezone INTO tz FROM agencies WHERE id = p_agency_id;
  now_local := (now() AT TIME ZONE tz);
  today := date_trunc('day', now_local)::date;
  yest := (date_trunc('day', now_local) - interval '1 day')::date;
  RETURN json_build_object('today', today::text, 'yesterday', yest::text);
END;
$$;

-- 1.5 Helper: Is 'now' equal to HH:MM in agency tz (± 2 minutes window)
CREATE OR REPLACE FUNCTION is_now_agency_time(p_agency_id uuid, p_hhmm text)
RETURNS json 
LANGUAGE plpgsql STABLE AS $$
DECLARE 
  tz text; 
  now_local time; 
  tgt time; 
  ok boolean;
BEGIN
  SELECT timezone INTO tz FROM agencies WHERE id = p_agency_id;
  now_local := (now() AT TIME ZONE tz)::time;
  tgt := (p_hhmm || ':00')::time;
  ok := abs(extract(epoch FROM (now_local - tgt))) <= 120; -- two-minute jitter
  RETURN json_build_object('ok', ok);
END;
$$;