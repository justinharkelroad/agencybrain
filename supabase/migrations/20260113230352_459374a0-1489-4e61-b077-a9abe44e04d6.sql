-- Soft delete: Deactivate NULL-role KPIs where role-specific versions now exist
-- This preserves historical metrics_daily data while removing duplicates from the UI
UPDATE kpis 
SET 
  is_active = false,
  archived_at = now()
WHERE role IS NULL 
  AND key IN ('outbound_calls', 'talk_minutes')
  AND agency_id IN (
    SELECT DISTINCT agency_id 
    FROM kpis 
    WHERE key IN ('outbound_calls', 'talk_minutes') 
      AND role IS NOT NULL
  );