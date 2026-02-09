-- Phase 2: Snapshot canonical read path performance
-- Optimizes the common query: latest locked snapshot by agency/date.

CREATE INDEX IF NOT EXISTS idx_metrics_daily_snapshots_lookup
  ON public.metrics_daily_snapshots (agency_id, snapshot_date, status, version DESC);
