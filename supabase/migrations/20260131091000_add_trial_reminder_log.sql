-- =============================================================================
-- TRIAL REMINDER LOG TABLE
-- =============================================================================
-- Tracks which reminder emails have been sent to prevent duplicates

CREATE TABLE IF NOT EXISTS trial_reminder_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  days_remaining INT NOT NULL,  -- 3, 1, or 0 (ended)
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Prevent duplicate reminders
  UNIQUE(subscription_id, days_remaining)
);

COMMENT ON TABLE trial_reminder_log IS 'Tracks trial reminder emails sent to prevent duplicates';

CREATE INDEX idx_trial_reminder_log_subscription ON trial_reminder_log(subscription_id);
CREATE INDEX idx_trial_reminder_log_agency ON trial_reminder_log(agency_id);

-- RLS
ALTER TABLE trial_reminder_log ENABLE ROW LEVEL SECURITY;

-- Only service role can access (used by cron function)
CREATE POLICY "Service role only"
  ON trial_reminder_log FOR ALL
  USING (auth.role() = 'service_role');
