
# Delete LQS Quotes and Sales for Justin Harkelroad (Standard Playbook Inc)

## What You Are Asking For

You want to **permanently delete** all LQS (Lead → Quote → Sale) quotes and sales data for the account `justin@hfiagencies.com`.

---

## Account Details

| Field | Value |
|-------|-------|
| **Email** | justin@hfiagencies.com |
| **Name** | Justin E Harkelroad |
| **Agency** | Standard Playbook Inc |
| **Agency ID** | 979e8713-c266-4b23-96a9-fabd34f1fc9e |

---

## Data That Will Be Permanently Deleted

| Data Type | Count | Date Range | Total Premium |
|-----------|-------|------------|---------------|
| **LQS Quotes** | 856 records | Oct 1, 2025 → Jan 24, 2026 | $1,096,016.98 |
| **LQS Sales** | 226 records | Sep 30, 2025 → Jan 24, 2026 | $212,046.41 |

---

## What Will NOT Be Deleted

- **LQS Households**: 2,124 household records will remain (they contain lead/contact info)
- **Original Sales table data**: The main `sales` table is separate from `lqs_sales`
- **Scorecards, meetings, compensation data**: All other Brain data stays intact
- **Team members, lead sources, marketing buckets**: Configuration data stays

---

## Clarifying Question

**Do you also want to delete the 2,124 LQS Households?**

Deleting households would remove all lead/contact records from LQS, giving you a completely clean slate. If you keep households but delete quotes/sales, the households will show as "Leads" with no quote or sale history.

---

## The Deletion Process

1. **Delete all `lqs_sales`** for agency `979e8713-c266-4b23-96a9-fabd34f1fc9e` (226 records)
2. **Delete all `lqs_quotes`** for agency `979e8713-c266-4b23-96a9-fabd34f1fc9e` (856 records)
3. (Optional) **Delete all `lqs_households`** if you want a full reset (2,124 records)

This will be done via SQL DELETE statements run through Supabase.

---

## Confirm Your Intent

Before I execute this, please confirm:
- **Delete quotes and sales only** - Keep households as leads
- **Delete everything (quotes, sales, AND households)** - Full LQS reset
