-- Add sharing infrastructure to onboarding_sequences for future community sharing feature
ALTER TABLE onboarding_sequences
ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS source_sequence_id UUID REFERENCES onboarding_sequences(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS clone_count INTEGER NOT NULL DEFAULT 0;

-- Index for public sequences (future community browse)
CREATE INDEX IF NOT EXISTS idx_onboarding_sequences_public
  ON onboarding_sequences(is_public) WHERE is_public = true;

-- Comments documenting the purpose of each column
COMMENT ON COLUMN onboarding_sequences.is_public IS 'When true, sequence is visible in community library';
COMMENT ON COLUMN onboarding_sequences.source_sequence_id IS 'Original sequence this was cloned from (for attribution)';
COMMENT ON COLUMN onboarding_sequences.clone_count IS 'Number of times this sequence has been cloned';
