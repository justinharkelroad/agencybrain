#!/usr/bin/env node

const SUPABASE_URL = process.env.SUPABASE_URL;
const LQS_MAINTENANCE_KEY = process.env.LQS_MAINTENANCE_KEY;

if (!SUPABASE_URL || !LQS_MAINTENANCE_KEY) {
  console.error("Missing SUPABASE_URL or LQS_MAINTENANCE_KEY");
  process.exit(1);
}

const [, , modeArg = "preview"] = process.argv;
const mode = ["preview", "inspect", "repair"].includes(modeArg) ? modeArg : "preview";

const body = {
  mode,
};

if (process.env.AGENCY_ID) body.agency_id = process.env.AGENCY_ID;
if (process.env.SALE_DATE_START) body.sale_date_start = process.env.SALE_DATE_START;
if (process.env.SALE_DATE_END) body.sale_date_end = process.env.SALE_DATE_END;
if (process.env.PRODUCER_NAME) body.producer_name = process.env.PRODUCER_NAME;
if (process.env.SALE_IDS) {
  body.sale_ids = process.env.SALE_IDS.split(",").map((value) => value.trim()).filter(Boolean);
}
if (process.env.LQS_AUDIT_LIMIT) {
  body.limit = Number(process.env.LQS_AUDIT_LIMIT);
}

const response = await fetch(`${SUPABASE_URL}/functions/v1/audit-lqs-sales-integrity`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-maintenance-key": LQS_MAINTENANCE_KEY,
  },
  body: JSON.stringify(body),
});

const payload = await response.json().catch(() => ({}));

if (!response.ok) {
  console.error(JSON.stringify(payload, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(payload, null, 2));
