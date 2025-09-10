-- Update metrics_daily records with KPI version info
-- Using outbound_calls KPI version for all sales metrics
UPDATE metrics_daily md
SET kpi_version_id = 'bf8feed4-4342-4b4c-b98b-ec87c59d7c36',
    label_at_submit = 'Outbound Calls',
    submitted_at = COALESCE(submitted_at, now())
WHERE md.id IN (
  'b9dd2b25-657e-48c6-b24f-b1ae1f08e74c',
  '27f902c3-12f2-42ed-aaf1-632cc458cc95',
  '016bf638-ef17-4d48-8503-50aecc1e0a2e',
  'c23ed9be-ece7-4313-9fa9-e39e5f48fd56',
  '33a5bcf5-f91b-4023-87b9-9eef5d3c5dd9'
);