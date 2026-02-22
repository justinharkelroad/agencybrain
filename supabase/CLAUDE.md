# Supabase CLAUDE.md

Rules for database migrations, edge functions, RLS policies, and Supabase-specific patterns.

## Database Conventions

- All tables have RLS policies enforcing agency isolation
- Use `FOR SELECT` for read-only dashboard queries
- Never use `SECURITY DEFINER` without explicit justification
- Migrations are versioned and reversible — never duplicate timestamps (PK conflict on `schema_migrations`)
- Never use `SECURITY INVOKER` in edge functions that need service-role access

## metrics_daily Rules (MANDATORY)

Written by multiple independent paths: scorecard submissions, dashboard "Add Quote", call sync triggers, sales sync triggers.

### Rule 1: GREATEST() on quoted_count and sold_items

Any `ON CONFLICT ... DO UPDATE` on `metrics_daily` MUST use GREATEST():

```sql
-- CORRECT:
quoted_count = GREATEST(COALESCE(metrics_daily.quoted_count, 0), EXCLUDED.quoted_count),
sold_items   = GREATEST(COALESCE(metrics_daily.sold_items, 0), EXCLUDED.sold_items),

-- WRONG (overwrites trigger-incremented values):
quoted_count = EXCLUDED.quoted_count,
```

Applies to: `upsert_metrics_from_submission`, `sync_call_metrics_to_metrics_daily`, `sync_lqs_sales_to_metrics_daily`, and any future upsert into `metrics_daily`.

### Rule 2: kpi_version_id and label_at_submit are required

CHECK constraint `md_version_fields_nonnull` rejects rows without them. Every INSERT must include both:

```sql
SELECT kv.id, kv.label INTO v_kpi_version_id, v_label
FROM kpi_versions kv
JOIN kpis k ON k.id = kv.kpi_id
WHERE k.agency_id = <agency_id> AND kv.valid_to IS NULL
ORDER BY kv.valid_from DESC LIMIT 1;

-- Fallback via form bindings:
SELECT kv.id, kv.label INTO v_kpi_version_id, v_label
FROM forms_kpi_bindings fb
JOIN kpi_versions kv ON kv.id = fb.kpi_version_id
JOIN form_templates ft ON ft.id = fb.form_template_id
WHERE ft.agency_id = <agency_id> AND kv.valid_to IS NULL
ORDER BY fb.created_at DESC LIMIT 1;
```

If no kpi_version found, **skip the INSERT** and log a warning.

### Rule 3: KPI extraction must handle ALL slugs

The loop over `form_schema->'kpis'` must process all KPI types:
- `custom_%` slugs → `custom_kpis` JSONB column
- Standard slugs (`outbound_calls`, `quoted_households`, `items_sold`) → corresponding column variable

**Never** add `IF v_selected_kpi_slug NOT LIKE 'custom_%' THEN CONTINUE;` — silently drops standard KPIs mapped via `custom_kpi_*` field keys.

### Rule 4: NEVER compute hits/pass from form payload values

The AFTER trigger `trg_metrics_daily_recalc_hits_pass` (migration `20260206120000`) automatically recalculates `hits`/`pass`/`daily_score` from stored values whenever metric columns change. Do NOT compute hits/pass inline — the trigger handles all write paths.

**Do not remove or disable this trigger.**

### Rule 5: Pass threshold uses `scorecard_rules.n_required`, NOT `array_length(selected_metrics)`

```sql
-- CORRECT:
v_pass := (v_hits >= COALESCE(rules.n_required, 2));

-- WRONG (requires ALL metrics to hit):
v_pass := (v_hits >= array_length(rules.selected_metrics, 1));
```

### Rule 6: onSuccess callbacks must invalidate cache

Any modal/form writing to `metrics_daily` must call `queryClient.invalidateQueries({ queryKey: ['dashboard-daily'] })` in `onSuccess`.

## lqs_households Rules (MANDATORY)

Single source of truth for LQS Roadmap pipeline (`lead` → `quoted` → `sold`). Contacts page also derives stages from this table.

### Rule 1: NEVER DELETE rows in bulk without checking linked contacts

```sql
-- WRONG (deletes legitimate open leads):
DELETE FROM lqs_households WHERE status = 'lead'
  AND NOT EXISTS (SELECT 1 FROM lqs_quotes q WHERE q.household_id = lqs_households.id);

-- CORRECT (checks for linked contacts first):
DELETE FROM lqs_households h
WHERE h.status = 'lead'
  AND h.contact_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM agency_contacts ac
    WHERE ac.agency_id = h.agency_id AND ac.household_key = h.household_key
  )
  AND NOT EXISTS (SELECT 1 FROM lqs_quotes q WHERE q.household_id = h.id)
  AND NOT EXISTS (SELECT 1 FROM lqs_sales s WHERE s.household_id = h.id);
```

### Rule 2: Contacts and lqs_households derive "Open Lead" differently

| System | How it determines "Open Lead" |
|--------|-------------------------------|
| **Contacts** (`get_contacts_by_stage`) | `lqs_households.status = 'lead'` OR no row (ELSE fallback) |
| **LQS Roadmap** (`useLqsData`) | `lqs_households.status = 'lead'` only |

A contact with no `lqs_households` row appears on Contacts but is invisible on LQS Roadmap. Bulk operations must consider both systems.

### Rule 3: Cleanup migrations must be scoped

- **Always scope** by `agency_id`, `created_at` range, or other criteria — never "all rows matching a status"
- **Prefer UPDATE over DELETE**
- **Never assume** `status='lead'` with no quotes is garbage — users manually add leads via AddLeadModal

## Sales Email Rules (MANDATORY)

### Rule 1: `sale_policies` column is `policy_type_name`

```typescript
// CORRECT:
sale_policies(policy_type_name)

// WRONG (silently kills query in fire-and-forget):
sale_policies(policy_type)
```

### Rule 2: Verify PostgREST nested select columns against actual schema

Check `src/integrations/supabase/types.ts` or the creating migration. PostgREST nested select errors are silent in fire-and-forget callers.

### Rule 3: Sales email functions are fire-and-forget

Errors in `send-sale-notification` and `send-daily-sales-summary` are invisible. Always test full invocation path end-to-end after changes.

### Key column reference

| Table | Column | Purpose |
|-------|--------|---------|
| `sale_policies` | `policy_type_name` | Display name (e.g., "Renters") |
| `sale_policies` | `product_type_id` | FK to `policy_types` (nullable) |
| `sales` | `total_policies` | Policy count |
| `sales` | `total_items` | Line item count |
| `sales` | `total_premium` | Premium amount |

## Email System Patterns

- **4 email functions**: `send_submission_feedback` (per-submission), `send_daily_summary` (scorecard), `send-daily-sales-summary` (sales leaderboard), `send-morning-digest` (morning briefing)
- `send_submission_feedback`: fire-and-forget via `EdgeRuntime.waitUntil`
- Scheduled functions: each has a GitHub Actions cron workflow — never rely on external cron
- Use Resend batch API (`/emails/batch`), not single endpoint with `to: [array]`
- Use `Intl.DateTimeFormat` for local hour calculation, not hardcoded UTC offsets
- Cron spanning midnight UTC: use `*` for days, filter inside function using local timezone
- Gating flags: `settings_json.sendDailySummary`, `settings_json.sendImmediateEmail !== false`, `sales_daily_summary_enabled`, `morning_digest_enabled`

## Critical Gotchas

- Call scoring contract drift causes silent data/UI mismatches.
  - Keep analyzer JSON schema aligned with frontend/email consumers for both `sales` and `service` call types.
  - Sales corrective plans must be section-routed (`rapport`, `value_building`, `closing`) before persistence; generic fields are fallback-only.
  - Normalize talk metrics from seconds and ensure the same derivation logic is used by all consumers.
  - If AI omits structured section fields, synthesize stable `feedback`/`tip` values before writing to `agency_calls`.
  - Preserve service schema expectations (`section_scores` array, `checklist` array, `suggestions` list) and avoid sales-only assumptions in shared render paths.

### FunctionsHttpError response body

When handling `FunctionsHttpError` from Supabase edge functions, the response body is in `error.context.json()`, NOT in `data`. Always use:

```ts
const errorBody = await error.context.json();
```

## Auth Release Gate Checklist

Before merging any auth/RLS/RPC change:

1. Cross-agency tamper test: same caller + different agency → 401/403
2. Same-agency test: same caller + own agency → 200
3. No enum literal mismatches (`app_member_status` must be `'active'|'inactive'`)
4. REVOKE+GRANT present and adjacent
5. Both JWT and staff token callers work; unauthenticated denied
6. Admin-only settings not visible on owner/staff pages
