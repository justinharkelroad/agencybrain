# Phone System Integration — Handoff

## Context

RingCentral blocked OAuth access for our app. The three remaining paths to get call data into AgencyBrain are:

1. **Email ingest** (primary) — Agency configures RingCentral to auto-email daily reports to a unique address like `calls-{key}@ingest.myagencybrain.com`. Mailgun receives the email and POSTs to our edge function.
2. **Manual upload** (fallback, already working) — Agency owner exports Excel from RingCentral, uploads via Settings → Integrations.
3. **Ricochet webhook** (already working) — Third-party phone system POSTs call events to `ricochet-webhook` edge function.

## What's Done

### Backend pipeline (fully working)
- `call_events` table — stores individual call records
- `call_metrics_daily` table — stores aggregated daily metrics per team member
- Trigger: `call_metrics_daily` → `metrics_daily` (fills Outbound Calls + Talk Time dashboard rings)
- Trigger: `lqs_sales` → `metrics_daily` (fills Items Sold dashboard ring)
- `ricochet-webhook` edge function — receives and processes call events
- `ringcentral-report-ingest` edge function — Route A (manual upload) processes Excel files, Route B (Mailgun) returns 501 stub

### Frontend (working)
- `RingCentralReportUpload` component in Settings → Integrations → Phone System Integrations
- Supports both "Calls" and "Users" RingCentral Excel report types

### Removed this session
- `RingCentralConnect` component (dead OAuth UI)
- `ringcentral-oauth-init` edge function
- `ringcentral-oauth-callback` edge function
- `ringcentral-sync-calls` edge function
- Their `config.toml` entries

### Database tables still in use
- `voip_integrations` — not used by OAuth anymore but the table exists; could be repurposed or left alone
- `call_events` — used by both ricochet-webhook and report-ingest
- `call_metrics_daily` — used by report-ingest (Users file) and synced to dashboard

## What Needs to Be Built

### 1. Email ingest (Mailgun → edge function)

**The flow:**
1. Agency gets a unique ingest email: `calls-{rc_ingest_key}@ingest.myagencybrain.com`
2. Agency configures RingCentral to email daily performance reports to that address
3. Mailgun receives the email, extracts attachments, POSTs multipart/form-data to `ringcentral-report-ingest`
4. Edge function processes the Excel attachment(s) — same logic as manual upload

**What's needed:**
- **Migration**: Add `rc_ingest_key` column to `agencies` table (text, unique, auto-generated). The `RingCentralReportUpload` component already tries to read this column but it doesn't exist yet.
- **Edge function Route B**: Implement the Mailgun multipart handler in `ringcentral-report-ingest` (currently returns 501). Needs to: parse multipart form data, extract the Excel attachment(s), identify the agency from the recipient email address (strip `calls-` prefix, look up `rc_ingest_key`), then run the same processing logic as Route A.
- **Mailgun configuration**: Set up an inbound route in Mailgun that forwards emails matching `calls-*@ingest.myagencybrain.com` to the edge function URL.
- **UI**: The `RingCentralReportUpload` component already displays the ingest email when `rc_ingest_key` exists. May want to add a "Generate ingest email" button or auto-generate on first visit to the integrations page.

### 2. Ricochet webhook verification

The `ricochet-webhook` edge function is fully built. Verify it works end-to-end:
- Confirm the webhook URL is registered with Ricochet
- Test with a real call event
- Verify data flows: `call_events` → `call_metrics_daily` → `metrics_daily` → dashboard rings

### 3. Minor cleanup

- `voip_integrations` table still exists with OAuth columns (`access_token`, `refresh_token`, etc.). These are dead. Not urgent — the table isn't hurting anything and the RLS policies are fine.
- `RINGCENTRAL_INTEGRATION_SPEC.md` at project root references the OAuth flow. Could be updated or removed.

## File Locations

| File | Purpose |
|------|---------|
| `supabase/functions/ringcentral-report-ingest/index.ts` | Excel processing + stubbed Mailgun route |
| `supabase/functions/ricochet-webhook/index.ts` | Ricochet call event webhook |
| `src/components/RingCentralReportUpload.tsx` | Upload UI + ingest email display |
| `src/pages/Agency.tsx` | Settings page (Integrations tab) |
| `supabase/migrations/20260127200000_voip_integration.sql` | Tables: voip_integrations, call_events, call_metrics_daily |
| `supabase/migrations/20260206100000_sync_call_metrics_to_dashboard.sql` | Trigger: call_metrics → metrics_daily |
| `supabase/migrations/20260206110000_sync_lqs_sales_to_metrics_daily.sql` | Trigger: lqs_sales → metrics_daily |
