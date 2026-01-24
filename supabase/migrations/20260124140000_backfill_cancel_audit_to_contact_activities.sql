-- Backfill cancel_audit_activities to contact_activities
-- This fixes activities that were logged before the sync bug was fixed
-- Note: created_by_staff_id is omitted because cancel_audit uses team_member_id (different FK)

INSERT INTO contact_activities (
  agency_id,
  contact_id,
  source_module,
  source_record_id,
  activity_type,
  notes,
  activity_date,
  created_by_display_name,
  created_at
)
SELECT
  caa.agency_id,
  car.contact_id,
  'cancel_audit' AS source_module,
  caa.record_id AS source_record_id,
  caa.activity_type,
  caa.notes,
  caa.created_at AS activity_date,
  caa.user_display_name AS created_by_display_name,
  caa.created_at
FROM cancel_audit_activities caa
JOIN cancel_audit_records car ON car.id = caa.record_id
WHERE car.contact_id IS NOT NULL
  -- Only insert if not already synced (avoid duplicates)
  AND NOT EXISTS (
    SELECT 1 FROM contact_activities ca
    WHERE ca.source_module = 'cancel_audit'
      AND ca.source_record_id = caa.record_id
      AND ca.activity_type = caa.activity_type
      AND ca.created_at = caa.created_at
  );
