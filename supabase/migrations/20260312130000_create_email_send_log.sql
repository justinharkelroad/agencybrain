-- Tracks which scheduled emails have been sent to prevent double-sends
-- when GitHub Actions cron runs are delayed or skipped.
-- The send-daily-sales-summary (and other cron email functions) use a 2-hour
-- window instead of exact-hour matching, and check this table to dedup.

CREATE TABLE IF NOT EXISTS email_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  email_type text NOT NULL,        -- e.g. 'daily_sales_summary', 'morning_digest'
  send_date date NOT NULL,         -- local date the email covers
  sent_at timestamptz NOT NULL DEFAULT now(),
  recipient_count int,
  UNIQUE (agency_id, email_type, send_date)
);

-- RLS: service role only (edge functions use service role key)
ALTER TABLE email_send_log ENABLE ROW LEVEL SECURITY;

-- Index for the dedup lookup
CREATE INDEX idx_email_send_log_lookup ON email_send_log (agency_id, email_type, send_date);

COMMENT ON TABLE email_send_log IS 'Prevents duplicate scheduled emails when GitHub Actions cron runs are delayed. Edge functions check (agency_id, email_type, send_date) before sending.';
