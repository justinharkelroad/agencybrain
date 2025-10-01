-- Full backfill for all failed submissions
INSERT INTO quoted_household_details (
  submission_id,
  agency_id,
  team_member_id,
  role,
  work_date,
  household_name,
  zip_code,
  lead_source_id,
  lead_source_label,
  items_quoted,
  policies_quoted,
  premium_potential_cents,
  extras,
  created_at
)
SELECT 
  s.id as submission_id,
  ft.agency_id,
  s.team_member_id,
  ft.role,
  COALESCE(s.work_date, s.submission_date) as work_date,
  detail.value->>'prospect_name' as household_name,
  detail.value->>'zip_code' as zip_code,
  (
    SELECT ls.id 
    FROM lead_sources ls 
    WHERE ls.agency_id = ft.agency_id 
      AND ls.name = COALESCE(detail.value->>'lead_source', detail.value->>'lead_source_label')
    LIMIT 1
  ) as lead_source_id,
  COALESCE(detail.value->>'lead_source', detail.value->>'lead_source_label') as lead_source_label,
  NULLIF((detail.value->>'items_quoted')::int, 0) as items_quoted,
  NULLIF((detail.value->>'policies_quoted')::int, 0) as policies_quoted,
  NULLIF((detail.value->>'premium_potential_cents')::bigint, 0) as premium_potential_cents,
  jsonb_build_object(
    'original_data', detail.value,
    'custom_fields', '{}'::jsonb,
    'detailed_notes', COALESCE(detail.value->>'detailed_notes', detail.value->>'notes')
  ) as extras,
  COALESCE(s.submitted_at, s.created_at, s.submission_date::timestamp with time zone) as created_at
FROM submissions s
JOIN form_templates ft ON ft.id = s.form_template_id
CROSS JOIN LATERAL jsonb_array_elements(s.payload_json->'quoted_details') AS detail(value)
WHERE EXISTS (
  SELECT 1 FROM vw_flattening_health fh
  WHERE fh.submission_id = s.id 
    AND fh.status = 'flattening_failed'
)
AND detail.value->>'prospect_name' IS NOT NULL
AND detail.value->>'prospect_name' != '';

-- Verify total records
SELECT COUNT(*) as total_records FROM quoted_household_details;

-- Check flattening status
SELECT status, COUNT(*) as count
FROM vw_flattening_health
GROUP BY status
ORDER BY status;

-- Show sample with timestamps including James Toney
SELECT 
  household_name,
  work_date,
  DATE(created_at) as created_date,
  TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') as exact_timestamp,
  CASE 
    WHEN DATE(created_at) = '2025-10-01' THEN '❌ Wrong (today)'
    ELSE '✅ Correct (original)'
  END as timestamp_status
FROM quoted_household_details
WHERE household_name ILIKE '%toney%'
   OR household_name ILIKE '%stallions%'
ORDER BY created_at DESC
LIMIT 5;