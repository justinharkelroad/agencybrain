#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = "true";
      continue;
    }
    args[key] = next;
    i += 1;
  }
  return args;
}

function mustEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function optionalEnv(name) {
  return process.env[name] ?? null;
}

function mustArg(args, key) {
  const value = args[key];
  if (!value) {
    throw new Error(`Missing required argument: --${key}`);
  }
  return value;
}

function toIntegerOrNull(value) {
  if (value === undefined) return null;
  if (value === null) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.trunc(parsed);
}

function toDecimalOrNull(value) {
  if (value === undefined) return null;
  if (value === null) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const args = parseArgs(process.argv);
  const filePath = path.resolve(mustArg(args, "file"));
  const reportMonth = mustArg(args, "report-month"); // YYYY-MM
  const carrierSchemaKey = mustArg(args, "carrier-schema-key");

  if (!filePath.toLowerCase().endsWith(".xlsx")) {
    throw new Error("Smoke test requires a .xlsx file.");
  }

  const fileBytes = await fs.readFile(filePath);
  if (fileBytes.byteLength === 0) {
    throw new Error(`Input file is empty: ${filePath}`);
  }

  const supabaseUrl = mustEnv("SUPABASE_URL");
  const supabaseAnonKey = mustEnv("SUPABASE_ANON_KEY");
  const accessToken = optionalEnv("SUPABASE_ACCESS_TOKEN");
  const userEmail = optionalEnv("SUPABASE_USER_EMAIL");
  const userPassword = optionalEnv("SUPABASE_USER_PASSWORD");

  const supabase = accessToken
    ? createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    })
    : createClient(supabaseUrl, supabaseAnonKey);

  let userId = null;
  if (accessToken) {
    const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !authData.user?.id) {
      throw new Error(`Token auth failed: ${authError?.message ?? "invalid access token"}`);
    }
    userId = authData.user.id;
  } else {
    if (!userEmail || !userPassword) {
      throw new Error(
        "Missing auth. Provide SUPABASE_ACCESS_TOKEN or SUPABASE_USER_EMAIL + SUPABASE_USER_PASSWORD."
      );
    }
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password: userPassword,
    });
    if (signInError || !signInData.session || !signInData.user) {
      throw new Error(`Auth failed: ${signInError?.message ?? "unknown error"}`);
    }
    userId = signInData.user.id;
  }
  const reportMonthDate = `${reportMonth}-01`;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("agency_id")
    .eq("id", userId)
    .single();
  if (profileError || !profile?.agency_id) {
    throw new Error(`Could not resolve agency for signed-in user: ${profileError?.message ?? "missing agency_id"}`);
  }
  const agencyId = profile.agency_id;

  const { data: carrierSchema, error: carrierError } = await supabase
    .from("carrier_schemas")
    .select("id, schema_key")
    .eq("schema_key", carrierSchemaKey)
    .single();
  if (carrierError || !carrierSchema) {
    throw new Error(`Carrier schema not found for key '${carrierSchemaKey}': ${carrierError?.message ?? "unknown error"}`);
  }

  const timestamp = Date.now();
  const storagePath = `${agencyId}/${reportMonth}/smoke-${timestamp}.xlsx`;
  const file = new Blob([fileBytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const { error: uploadError } = await supabase.storage
    .from("business-metrics")
    .upload(storagePath, file, { upsert: true });
  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`);
  }

  const { data: existingRows, error: existingError } = await supabase
    .from("business_metrics_reports")
    .select("id")
    .eq("agency_id", agencyId)
    .eq("report_month", reportMonthDate)
    .eq("carrier_schema_id", carrierSchema.id)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (existingError) {
    throw new Error(`Report lookup failed: ${existingError.message}`);
  }
  const existingId = existingRows?.[0]?.id ?? null;

  let reportId;
  if (existingId) {
    const { data: updateRow, error: updateError } = await supabase
      .from("business_metrics_reports")
      .update({
        user_id: userId,
        carrier_schema_id: carrierSchema.id,
        report_month: reportMonthDate,
        original_filename: path.basename(filePath),
        file_path: storagePath,
        parse_status: "pending",
        parse_error: null,
        parsed_data: null,
        agent_code: null,
        agent_name: null,
      })
      .eq("id", existingId)
      .select("id")
      .single();
    if (updateError || !updateRow?.id) {
      throw new Error(`Report update failed: ${updateError?.message ?? "missing id"}`);
    }
    reportId = updateRow.id;
  } else {
    const { data: insertRow, error: insertError } = await supabase
      .from("business_metrics_reports")
      .insert({
        agency_id: agencyId,
        user_id: userId,
        carrier_schema_id: carrierSchema.id,
        report_month: reportMonthDate,
        original_filename: path.basename(filePath),
        file_path: storagePath,
        parse_status: "pending",
      })
      .select("id")
      .single();
    if (insertError || !insertRow?.id) {
      throw new Error(`Report insert failed: ${insertError?.message ?? "missing id"}`);
    }
    reportId = insertRow.id;
  }

  const { error: parseInvokeError } = await supabase.functions.invoke("parse_business_metrics", {
    body: {
      report_id: reportId,
      carrier_schema_key: carrierSchemaKey,
    },
  });
  if (parseInvokeError) {
    throw new Error(`Parse invoke failed: ${parseInvokeError.message}`);
  }

  const started = Date.now();
  const timeoutMs = Number(args["timeout-ms"] ?? 90000);
  let parseStatus = "pending";
  let parseErrorMessage = null;
  while (Date.now() - started < timeoutMs) {
    const { data: row, error } = await supabase
      .from("business_metrics_reports")
      .select("parse_status, parse_error")
      .eq("id", reportId)
      .single();
    if (error) {
      throw new Error(`Polling parse status failed: ${error.message}`);
    }
    parseStatus = row.parse_status;
    parseErrorMessage = row.parse_error;
    if (parseStatus === "parsed" || parseStatus === "error") {
      break;
    }
    await sleep(2000);
  }

  if (parseStatus !== "parsed") {
    throw new Error(`Parse did not finish successfully. status=${parseStatus} parse_error=${parseErrorMessage ?? "--"}`);
  }

  const { data: snapshot, error: snapshotError } = await supabase
    .from("business_metrics_snapshots")
    .select("*")
    .eq("report_id", reportId)
    .single();
  if (snapshotError || !snapshot) {
    throw new Error(`Snapshot not found for parsed report: ${snapshotError?.message ?? "missing row"}`);
  }

  const expectedCappedItemsTotal = toIntegerOrNull(args["expect-capped-items-total"]);
  const expectedRetentionCurrent = toDecimalOrNull(args["expect-retention-current"]);
  const expectedPremiumYtdTotalCents = toIntegerOrNull(args["expect-premium-ytd-total-cents"]);

  if (expectedCappedItemsTotal !== null && snapshot.capped_items_total !== expectedCappedItemsTotal) {
    throw new Error(`Mismatch capped_items_total. expected=${expectedCappedItemsTotal} actual=${snapshot.capped_items_total}`);
  }
  if (expectedRetentionCurrent !== null && snapshot.retention_current !== expectedRetentionCurrent) {
    throw new Error(`Mismatch retention_current. expected=${expectedRetentionCurrent} actual=${snapshot.retention_current}`);
  }
  if (expectedPremiumYtdTotalCents !== null && snapshot.premium_ytd_total !== expectedPremiumYtdTotalCents) {
    throw new Error(`Mismatch premium_ytd_total. expected=${expectedPremiumYtdTotalCents} actual=${snapshot.premium_ytd_total}`);
  }

  // At least one core metric should be non-null for a meaningful parse.
  const hasCoreMetric =
    snapshot.capped_items_total !== null ||
    snapshot.retention_current !== null ||
    snapshot.premium_ytd_total !== null;
  if (!hasCoreMetric) {
    throw new Error("Snapshot row exists but core metrics are all null (capped_items_total, retention_current, premium_ytd_total).");
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        reportId,
        reportMonth,
        carrierSchemaKey,
        parseStatus,
        snapshot: {
          id: snapshot.id,
          capped_items_total: snapshot.capped_items_total,
          retention_current: snapshot.retention_current,
          premium_ytd_total: snapshot.premium_ytd_total,
          loss_ratio_12mm: snapshot.loss_ratio_12mm,
        },
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(`[growth-center-live-smoke] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
