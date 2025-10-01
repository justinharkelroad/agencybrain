
-- Flatten the specific submission for Dominic Ricco
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
  (detail.value->>'lead_source_id')::uuid as lead_source_id,
  detail.value->>'lead_source_label' as lead_source_label,
  (detail.value->>'field_1759198706406')::int as items_quoted,
  (detail.value->>'field_1759198718894')::int as policies_quoted,
  (REPLACE(detail.value->>'field_1759198745973', '.', '')::numeric * 100)::bigint as premium_potential_cents,
  jsonb_build_object(
    'original_data', detail.value,
    'custom_fields', '{}'::jsonb,
    'detailed_notes', detail.value->>'detailed_notes'
  ) as extras,
  s.submitted_at as created_at
FROM submissions s
JOIN form_templates ft ON ft.id = s.form_template_id
CROSS JOIN LATERAL jsonb_array_elements(s.payload_json->'quoted_details') AS detail(value)
WHERE s.id = '9a60b221-931b-4e07-881e-b2b59162fdf1'
  AND detail.value->>'prospect_name' IS NOT NULL;

-- Verify the record was created
SELECT 
  household_name,
  work_date,
  DATE(created_at) as created_date,
  TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') as exact_timestamp,
  lead_source_label,
  items_quoted,
  policies_quoted,
  premium_potential_cents,
  CASE 
    WHEN DATE(created_at) = '2025-10-01' THEN '✅ Correct (Oct 1, 2025)'
    ELSE '❌ Wrong date'
  END as timestamp_check
FROM quoted_household_details
WHERE submission_id = '9a60b221-931b-4e07-881e-b2b59162fdf1';

-- Check updated flattening status
SELECT
  submission_id,
  status,
  expected_records,
  actual_records
FROM vw_flattening_health
WHERE submission_id = '9a60b221-931b-4e07-881e-b2b59162fdf1';
