# Flattening Health Monitoring Queries

## Quick Health Check

### Overall Summary
```sql
SELECT * FROM vw_flattening_summary;
```

Returns:
- `total_submissions`: Total submissions in last 30 days
- `submissions_with_quoted_details`: Submissions that have quoted_details
- `successful_flattenings`: Successfully flattened submissions
- `failed_flattenings`: Submissions that failed to flatten
- `partial_flattenings`: Submissions with partial flattening
- `no_quoted_details`: Submissions without quoted_details
- `total_expected_records`: Total records expected
- `total_actual_records`: Total records created
- `success_rate_percent`: Success rate percentage

---

## Detailed Queries

### Find Failed Flattenings
```sql
SELECT 
  submission_id,
  submission_date,
  work_date,
  expected_records,
  actual_records,
  status
FROM vw_flattening_health
WHERE status = 'flattening_failed'
ORDER BY submission_date DESC
LIMIT 20;
```

### Find Partial Flattenings
```sql
SELECT 
  submission_id,
  submission_date,
  work_date,
  expected_records,
  actual_records,
  (expected_records - actual_records) as missing_records
FROM vw_flattening_health
WHERE status = 'partial_flattening'
ORDER BY missing_records DESC
LIMIT 20;
```

### Status Distribution
```sql
SELECT 
  status,
  COUNT(*) as submission_count,
  SUM(expected_records) as total_expected,
  SUM(actual_records) as total_actual,
  ROUND(AVG(expected_records), 2) as avg_expected_per_submission
FROM vw_flattening_health
GROUP BY status
ORDER BY submission_count DESC;
```

---

## Test Individual Submission

### Test flattening a specific submission
```sql
-- Replace YOUR_SUBMISSION_ID with actual submission ID
SELECT flatten_quoted_household_details_enhanced('YOUR_SUBMISSION_ID'::uuid);
```

Returns JSON with:
```json
{
  "success": true,
  "records_created": 3,
  "error_message": null
}
```

Or on error:
```json
{
  "success": false,
  "records_created": 1,
  "error_message": "division by zero",
  "sql_state": "22012"
}
```

---

## Debug Specific Submission

### Check if submission has quoted_details
```sql
SELECT 
  s.id,
  s.payload_json ? 'quoted_details' as has_key,
  jsonb_typeof(s.payload_json->'quoted_details') as type,
  CASE 
    WHEN jsonb_typeof(s.payload_json->'quoted_details') = 'array' 
    THEN jsonb_array_length(s.payload_json->'quoted_details')
    ELSE NULL
  END as array_length
FROM submissions s
WHERE s.id = 'YOUR_SUBMISSION_ID'::uuid;
```

### Check flattened records for submission
```sql
SELECT 
  id,
  household_name,
  items_quoted,
  policies_quoted,
  premium_potential_cents,
  extras->'custom_fields' as custom_fields,
  created_at
FROM quoted_household_details
WHERE submission_id = 'YOUR_SUBMISSION_ID'::uuid
ORDER BY created_at DESC;
```

---

## Monitoring Logs

### View Postgres logs for flattening function
To see the detailed logs from the function (NOTICE, WARNING levels), check the Supabase Dashboard:
1. Go to your project dashboard
2. Navigate to Database → Logs
3. Filter by keyword: `flatten_quoted_household_details_enhanced`

Logs include:
- `START - submission_id: [UUID]`
- `Payload keys found: [list]`
- `Found X quoted_details entries to process`
- `Built custom fields map with X fields`
- `Successfully created X quoted_household_details records`
- Warnings for missing data or errors

---

## Automated Monitoring Setup

### Daily Health Check Query
Run this daily to monitor system health:
```sql
WITH today_summary AS (
  SELECT * FROM vw_flattening_summary
),
trend AS (
  SELECT 
    DATE(submission_date) as date,
    COUNT(*) as submissions,
    COUNT(*) FILTER (WHERE status = 'success') as successful,
    COUNT(*) FILTER (WHERE status = 'flattening_failed') as failed
  FROM vw_flattening_health
  WHERE submission_date >= CURRENT_DATE - interval '7 days'
  GROUP BY DATE(submission_date)
  ORDER BY date DESC
)
SELECT 
  (SELECT success_rate_percent FROM today_summary) as current_success_rate,
  (SELECT failed_flattenings FROM today_summary) as current_failed_count,
  json_agg(trend.*) as last_7_days_trend
FROM trend;
```

### Alert Conditions
Set up alerts when:
- `success_rate_percent < 95%` - Success rate dropped below 95%
- `failed_flattenings > 10` - More than 10 failures
- `partial_flattenings > 5` - More than 5 partial flattenings

---

## Re-flatten Failed Submissions

### Identify and re-flatten failed submissions
```sql
DO $$
DECLARE
  v_submission_id uuid;
  v_result jsonb;
BEGIN
  FOR v_submission_id IN 
    SELECT submission_id 
    FROM vw_flattening_health 
    WHERE status = 'flattening_failed'
    LIMIT 10
  LOOP
    v_result := flatten_quoted_household_details_enhanced(v_submission_id);
    RAISE NOTICE 'Submission %: %', v_submission_id, v_result;
  END LOOP;
END $$;
```

---

## Custom Field Extraction Verification

### Verify custom fields are being extracted
```sql
SELECT 
  qhd.submission_id,
  qhd.household_name,
  jsonb_object_keys(qhd.extras->'custom_fields') as custom_field_name,
  qhd.extras->'custom_fields'->jsonb_object_keys(qhd.extras->'custom_fields') as field_data
FROM quoted_household_details qhd
WHERE qhd.extras->'custom_fields' IS NOT NULL
  AND jsonb_typeof(qhd.extras->'custom_fields') = 'object'
LIMIT 20;
```
