# Ricochet Webhook Integration

## Overview

Ricochet is a Speed to Contact dialer. This integration receives webhook POST requests from Ricochet when calls occur, stores them in `call_events`, and updates related tables for metrics and activity tracking.

## Webhook URL

```
https://api.myagencybrain.com/functions/v1/ricochet-webhook?agency_id=<uuid>
```

Each agency has a unique webhook URL with their `agency_id` as a query parameter.

**Configuration in Ricochet:** Point the webhook to this URL with the appropriate agency UUID.

---

## Edge Function

**File:** `supabase/functions/ricochet-webhook/index.ts`

**Config:** `supabase/config.toml`
```toml
[functions.ricochet-webhook]
verify_jwt = false
```

No JWT verification (external webhook from Ricochet).

---

## Expected Payload

Ricochet sends a JSON POST body with these fields:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique call identifier (external_call_id) |
| `phone` | string | One of the phone numbers involved |
| `to` | string | The other phone number involved |
| `outbound` | boolean | `true` = outbound call, `false` = inbound |
| `Duration` | integer | Talk time in seconds |
| `created_at` | timestamp | When the call started |
| `answered_at` | timestamp | When answered (may be null) |
| `User's name` | string | Agent name (e.g., "Chris Guillen") |
| `User's email` | string | Agent email (backup for matching) |

### Example Payload

```json
{
  "id": "call_abc123",
  "phone": "+1 (555) 123-4567",
  "to": "+1 (555) 987-6543",
  "outbound": true,
  "Duration": 245,
  "created_at": "2026-02-05T14:30:00Z",
  "answered_at": "2026-02-05T14:30:05Z",
  "User's name": "Chris Guillen",
  "User's email": "chris@agency.com"
}
```

---

## Matching Logic

### Team Member Matching

1. Match `User's name` against `team_members.name` (case-insensitive) WHERE `agency_id` matches
2. If no match by name, try matching `User's email` against `team_members.email`
3. If still no match, `matched_team_member_id = null` (call is still inserted)

### Prospect Matching

1. Normalize both `phone` and `to` fields:
   - Strip all non-digits
   - Remove leading `1` if 11 digits (US country code)
2. Query `lqs_households` WHERE `agency_id` matches
3. Check if normalized `phone` from household matches either normalized `phone` or `to` from payload
4. The customer's number is whichever one matches `lqs_households.phone`
5. If match found, set `matched_prospect_id = lqs_households.id`
6. If no match, `matched_prospect_id = null` (call is still inserted)

---

## Database Tables Affected

### 1. `call_events` (INSERT)

| Column | Value |
|--------|-------|
| `agency_id` | From query param |
| `provider` | `'ricochet'` |
| `external_call_id` | `payload.id` |
| `direction` | `'Outbound'` or `'Inbound'` based on `outbound` boolean |
| `from_number` | `payload.phone` |
| `to_number` | `payload.to` |
| `duration_seconds` | `payload.Duration` |
| `call_started_at` | `payload.created_at` |
| `call_ended_at` | `null` (not provided by Ricochet) |
| `result` | `'completed'` |
| `extension_name` | `User's name` from payload |
| `matched_team_member_id` | From team member matching |
| `matched_prospect_id` | From prospect matching |
| `raw_payload` | Full JSON body |

**Deduplication:** Uses `UNIQUE(provider, external_call_id)` constraint. Duplicate calls return 200 OK without re-inserting.

### 2. `call_metrics_daily` (UPSERT)

Only updated if `matched_team_member_id` is found.

Aggregates all calls for that team member on today's date:

| Column | Calculation |
|--------|-------------|
| `total_calls` | COUNT all calls |
| `inbound_calls` | COUNT where `direction = 'Inbound'` |
| `outbound_calls` | COUNT where `direction = 'Outbound'` |
| `answered_calls` | COUNT where `duration_seconds > 0` |
| `missed_calls` | COUNT where `duration_seconds = 0` |
| `total_talk_seconds` | SUM of `duration_seconds` |

### 3. `contact_activities` (INSERT)

Only inserted if `matched_prospect_id` is found.

| Column | Value |
|--------|-------|
| `agency_id` | From query param |
| `contact_type` | `'prospect'` |
| `prospect_id` | `matched_prospect_id` |
| `activity_type` | `'call_outbound'` or `'call_inbound'` |
| `activity_source` | `'ricochet'` |
| `title` | `'Outbound Call'` or `'Inbound Call'` |
| `description` | `'{direction} call - {duration}s'` |
| `metadata` | `{ duration_seconds, provider, external_call_id, team_member_id }` |
| `occurred_at` | `payload.created_at` |

---

## Response Format

### Success (new call)
```json
{
  "success": true,
  "call_id": "uuid-of-inserted-call",
  "matched_team_member": true,
  "matched_prospect": false
}
```

### Success (duplicate call)
```json
{
  "success": true,
  "call_id": "uuid-of-existing-call",
  "duplicate": true,
  "matched_team_member": false,
  "matched_prospect": false
}
```

### Error
```json
{
  "error": "Error message here"
}
```

---

## Error Handling

| Status | Condition |
|--------|-----------|
| 200 | Success (including duplicates) |
| 400 | Missing `agency_id` query param |
| 400 | Invalid `agency_id` UUID format |
| 400 | Missing required field `id` in payload |
| 405 | Non-POST request |
| 500 | Database insert error |
| 500 | Other internal errors |

---

## Testing

### Manual Test with cURL

```bash
curl -X POST "https://api.myagencybrain.com/functions/v1/ricochet-webhook?agency_id=YOUR_AGENCY_UUID" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test_call_001",
    "phone": "+15551234567",
    "to": "+15559876543",
    "outbound": true,
    "Duration": 120,
    "created_at": "2026-02-05T14:30:00Z",
    "answered_at": "2026-02-05T14:30:05Z",
    "User'\''s name": "Test Agent",
    "User'\''s email": "test@example.com"
  }'
```

### Verify in Database

```sql
-- Check call was inserted
SELECT * FROM call_events
WHERE provider = 'ricochet'
AND external_call_id = 'test_call_001';

-- Check metrics updated (if team member matched)
SELECT * FROM call_metrics_daily
WHERE date = CURRENT_DATE;

-- Check activity logged (if prospect matched)
SELECT * FROM contact_activities
WHERE activity_source = 'ricochet'
ORDER BY created_at DESC LIMIT 5;
```

---

## Deployment

```bash
# Deploy the function
supabase functions deploy ricochet-webhook

# Verify config.toml has the entry
grep -A1 "ricochet-webhook" supabase/config.toml
```

---

## Troubleshooting

### Calls not matching team members
- Check `team_members` table has correct names/emails for the agency
- Name matching is case-insensitive but must be exact
- Verify the agency_id in the webhook URL matches the team members' agency

### Calls not matching prospects
- Check `lqs_households` table has phone numbers populated
- Phone normalization strips formatting - `+1 (555) 123-4567` becomes `5551234567`
- Both `phone` and `to` fields are checked against household phones

### Duplicate handling
- Duplicates are detected by `provider + external_call_id`
- Function returns 200 OK for duplicates (idempotent)
- Check `raw_payload` in `call_events` if data seems wrong

### Logs
```bash
# View function logs in Supabase Dashboard
# Or use CLI:
supabase functions logs ricochet-webhook
```

---

## Related Files

- `supabase/functions/ricochet-webhook/index.ts` - Main function code
- `supabase/config.toml` - Function configuration
- `RINGCENTRAL_INTEGRATION_SPEC.md` - Schema definitions for `call_events`, `call_metrics_daily`, `contact_activities`
