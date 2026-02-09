-- Email ingest logs: track Mailgun-forwarded VOIP report processing
CREATE TABLE email_ingest_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  sender TEXT,
  recipient TEXT NOT NULL,
  subject TEXT,
  message_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed', 'rejected')),
  attachment_count INTEGER DEFAULT 0,
  files_processed INTEGER DEFAULT 0,
  processing_results JSONB DEFAULT '[]',
  error_message TEXT,
  received_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ,
  processing_duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_email_ingest_logs_agency ON email_ingest_logs(agency_id, created_at DESC);
CREATE INDEX idx_email_ingest_logs_message_id ON email_ingest_logs(message_id) WHERE message_id IS NOT NULL;

ALTER TABLE email_ingest_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agency members view email_ingest_logs"
  ON email_ingest_logs FOR SELECT
  USING (has_agency_access(auth.uid(), agency_id));

-- Backfill rc_ingest_key for any agencies missing one
UPDATE agencies
SET rc_ingest_key = substr(md5(random()::text || id::text), 1, 8)
WHERE rc_ingest_key IS NULL OR rc_ingest_key = '';
