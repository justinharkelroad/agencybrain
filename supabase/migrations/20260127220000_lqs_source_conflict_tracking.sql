-- ============================================
-- LQS Lead Source Conflict Tracking
-- Tracks when multiple lead sources claim the same household
-- ============================================

-- Add columns to track attention reason and conflicting source
ALTER TABLE public.lqs_households
  ADD COLUMN IF NOT EXISTS attention_reason TEXT,
  ADD COLUMN IF NOT EXISTS conflicting_lead_source_id UUID REFERENCES public.lead_sources(id) ON DELETE SET NULL;

-- Add check constraint for valid attention reasons
ALTER TABLE public.lqs_households
  ADD CONSTRAINT lqs_households_attention_reason_check
  CHECK (attention_reason IS NULL OR attention_reason IN ('missing_lead_source', 'source_conflict', 'manual_review', 'ambiguous_match'));

-- Index for finding conflicts quickly
CREATE INDEX IF NOT EXISTS idx_lqs_households_attention_reason
  ON public.lqs_households(agency_id, attention_reason)
  WHERE attention_reason IS NOT NULL;

-- Add comment explaining the columns
COMMENT ON COLUMN public.lqs_households.attention_reason IS 'Why this household needs attention: missing_lead_source, source_conflict, manual_review, ambiguous_match';
COMMENT ON COLUMN public.lqs_households.conflicting_lead_source_id IS 'When attention_reason=source_conflict, this is the second source that tried to claim the household';
