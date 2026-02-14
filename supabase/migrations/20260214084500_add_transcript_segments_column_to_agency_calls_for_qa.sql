-- Add transcript_segments if absent so timestamped Q&A can run end-to-end.
ALTER TABLE public.agency_calls
ADD COLUMN IF NOT EXISTS transcript_segments JSONB;

COMMENT ON COLUMN public.agency_calls.transcript_segments IS
  'Timestamped transcript segments used for timeline-based call QA features';
