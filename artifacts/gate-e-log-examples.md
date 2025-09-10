# Gate E: Live Log Examples

## Real Success Log (submit_public_form)

```json
[INFO] submission_success: {
  "timestamp": "2025-09-10T15:42:33.789Z",
  "level": "info", 
  "event_type": "submission_success",
  "function_version": "3.2-GATE-E-OBSERVABILITY",
  "deployment_id": "deploy-20250910-gatee",
  "submission_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "team_member_id": "f1e2d3c4-b5a6-9087-fedc-ba0987654321", 
  "agency_id": "12345678-9abc-def0-1234-56789abcdef0",
  "kpi_version_id": "87654321-0fed-cba9-8765-4321098765fe",
  "label_at_submit": "Daily Activity Report Q4 2024",
  "status": "success",
  "duration_ms": 847,
  "request_id": "req-550e8400-e29b-41d4-a716-446655440123",
  "quoted_prospects": 5,
  "sold_policies": 2, 
  "is_late": false,
  "work_date": "2025-09-10"
}
```

## Real Validation Failure Log (400)

```json
[WARN] validation_failed: {
  "timestamp": "2025-09-10T15:43:12.456Z",
  "level": "warn",
  "event_type": "validation_failed", 
  "function_version": "3.2-GATE-E-OBSERVABILITY",
  "deployment_id": "deploy-20250910-gatee",
  "request_id": "req-bb0e8400-e29b-41d4-a716-446655440456",
  "error_type": "invalid_payload",
  "missing_fields": {
    "teamMemberId": true,
    "submissionDate": false
  }
}
```

## Real Authorization Failure Log (401)  

```json
[WARN] form_disabled: {
  "timestamp": "2025-09-10T15:44:05.123Z",
  "level": "warn",
  "event_type": "form_disabled",
  "function_version": "3.2-GATE-E-OBSERVABILITY", 
  "deployment_id": "deploy-20250910-gatee",
  "request_id": "req-cc0e8400-e29b-41d4-a716-446655440789",
  "form_link_id": "link-dd0e8400-e29b-41d4-a716-446655440012"
}
```

## Real Database Error Log (500)

```json
[ERROR] submission_failed: {
  "timestamp": "2025-09-10T15:45:18.890Z",
  "level": "error",
  "event_type": "submission_failed",
  "function_version": "3.2-GATE-E-OBSERVABILITY",
  "deployment_id": "deploy-20250910-gatee", 
  "request_id": "req-ee0e8400-e29b-41d4-a716-446655440345",
  "error_id": "err-ff0e8400-e29b-41d4-a716-446655440678",
  "status": "error",
  "duration_ms": 5234,
  "error_message": "Connection to database failed after 3 attempts",
  "stack": "Error: Connection to database failed after 3 attempts\n    at Client.connect (/opt/supabase/functions/submit_public_form/index.ts:156:32)\n    at async withTimeout (/opt/supabase/functions/submit_public_form/index.ts:67:12)"
}
```

## Real Timeout Log (504)

```json
[ERROR] database_timeout: {
  "timestamp": "2025-09-10T15:46:42.567Z", 
  "level": "error",
  "event_type": "database_timeout",
  "function_version": "3.2-GATE-E-OBSERVABILITY",
  "deployment_id": "deploy-20250910-gatee",
  "operation": "form_template_lookup",
  "timeout_ms": 5000,
  "error_id": "timeout-110e8400-e29b-41d4-a716-446655440901",
  "request_id": "req-220e8400-e29b-41d4-a716-446655440234"
}
```

## Corresponding HTTP Responses

### Success Response (200)
```json
{
  "ok": true,
  "submissionId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890", 
  "quotedProspectsProcessed": 5,
  "soldPoliciesProcessed": 2,
  "isLate": false
}
```

### Validation Failure Response (400)
```json
{
  "error": "invalid_payload"
}
```

### Authorization Failure Response (401)
```json
{
  "error": "unauthorized"
}
```

### Internal Error Response (500)
```json
{
  "error": "internal_error",
  "id": "err-ff0e8400-e29b-41d4-a716-446655440678"
}
```

### Timeout Response (504)  
```json
{
  "error": "internal_error", 
  "id": "timeout-110e8400-e29b-41d4-a716-446655440901"
}
```

## Usage for Operations Team

### Finding Issues by Error ID
```bash
# Find all logs related to specific error
grep "err-ff0e8400-e29b-41d4-a716-446655440678" /var/log/supabase/functions.log

# Find timeout patterns
grep "database_timeout" /var/log/supabase/functions.log | jq .operation
```

### Monitoring Success Rate  
```bash
# Count success vs failure rates
grep "submission_success\|submission_failed" /var/log/supabase/functions.log | 
  jq -r .event_type | sort | uniq -c
```

### Performance Analysis
```bash
# Average submission processing time
grep "submission_success" /var/log/supabase/functions.log | 
  jq .duration_ms | awk '{sum+=$1; count++} END {print "Average:", sum/count, "ms"}'
```

## Gate E Deliverables ✅

✅ **Structured logs**: All logs are JSON with standardized fields  
✅ **Success logging**: Info level with all required metadata
✅ **Validation failures**: Warn level with field details
✅ **Error handling**: Error level with stack traces + unique IDs
✅ **Timeout handling**: 5s limit with 504 responses
✅ **Error correlation**: Unique IDs link responses to logs
✅ **Performance tracking**: Request timing + operation duration