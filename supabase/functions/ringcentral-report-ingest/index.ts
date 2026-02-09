import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import * as XLSX from "https://esm.sh/xlsx@0.18.5/xlsx.mjs";

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB

// ─── Utility functions ───

function normalizePhone(phone: string | number | null | undefined): string | null {
  if (!phone && phone !== 0) return null;
  const str = String(phone);
  const digits = str.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.substring(1);
  if (digits.length === 10) return digits;
  return digits || null;
}

function extractCallerName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const dashIndex = trimmed.indexOf(" - ");
  if (dashIndex !== -1) {
    return trimmed.substring(dashIndex + 3).trim() || trimmed;
  }
  return trimmed;
}

function parseDuration(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return Math.round(value * 86400);
  if (typeof value === "string") {
    const parts = value.split(":");
    if (parts.length === 3) {
      const [h, m, s] = parts.map(Number);
      return (h * 3600) + (m * 60) + (s || 0);
    }
    if (parts.length === 2) {
      const [m, s] = parts.map(Number);
      return (m * 60) + (s || 0);
    }
    const num = Number(value);
    if (!isNaN(num)) return Math.round(num * 86400);
  }
  return 0;
}

function parseReportDate(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "number") {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      const y = date.y;
      const m = String(date.m).padStart(2, "0");
      const d = String(date.d).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
    return null;
  }
  if (typeof value === "string") {
    const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (match) {
      const [, mm, dd, yyyy] = match;
      return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
    }
    const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) return isoMatch[0];
  }
  return null;
}

function extractReportDateFromFilters(workbook: XLSX.WorkBook): string | null {
  if (!workbook.SheetNames.includes("Filters")) return null;
  const filtersSheet = workbook.Sheets["Filters"];
  const filtersData = XLSX.utils.sheet_to_json(filtersSheet, { raw: true }) as Record<string, unknown>[];
  for (const row of filtersData) {
    const fromTime = row["From Time"] || row["from_time"] || row["From time"];
    if (fromTime) return parseReportDate(fromTime);
  }
  return null;
}

function getCol(row: Record<string, unknown>, ...names: string[]): unknown {
  for (const n of names) {
    if (row[n] !== undefined && row[n] !== null) return row[n];
  }
  return undefined;
}

// ─── Lookup context shared between Route A and Route B ───

interface AgencyLookups {
  agencyId: string;
  teamByName: Map<string, string>;
  householdByPhone: Map<string, string>;
  contactByPhone: Map<string, string>;
}

async function loadAgencyLookups(supabase: SupabaseClient, agencyId: string): Promise<AgencyLookups> {
  const [teamResult, householdsResult, contactsResult] = await Promise.all([
    supabase.from("team_members").select("id, name, email").eq("agency_id", agencyId),
    supabase.from("lqs_households").select("id, phone").eq("agency_id", agencyId).not("phone", "is", null),
    supabase.from("agency_contacts").select("id, phones").eq("agency_id", agencyId),
  ]);

  const teamByName = new Map<string, string>();
  for (const tm of (teamResult.data || [])) {
    if (tm.name) teamByName.set(tm.name.toLowerCase(), tm.id);
  }

  const householdByPhone = new Map<string, string>();
  for (const h of (householdsResult.data || [])) {
    const norm = normalizePhone(h.phone);
    if (norm) householdByPhone.set(norm, h.id);
  }

  const contactByPhone = new Map<string, string>();
  for (const c of (contactsResult.data || [])) {
    if (c.phones && Array.isArray(c.phones)) {
      for (const p of c.phones) {
        const norm = normalizePhone(p);
        if (norm) contactByPhone.set(norm, c.id);
      }
    }
  }

  console.log(`[ringcentral-report-ingest] Loaded ${teamByName.size} team members, ${householdByPhone.size} households, ${contactByPhone.size} contacts`);
  return { agencyId, teamByName, householdByPhone, contactByPhone };
}

function matchTeamMember(lookups: AgencyLookups, name: string | null): string | null {
  if (!name) return null;
  const nameLower = name.toLowerCase();
  const exact = lookups.teamByName.get(nameLower);
  if (exact) return exact;
  for (const [tmName, tmId] of lookups.teamByName) {
    if (tmName.includes(nameLower) || nameLower.includes(tmName)) return tmId;
  }
  return null;
}

// ─── XLSX processing (shared by Route A and Route B) ───

interface XlsxProcessResult {
  success: boolean;
  file_type: "calls" | "users" | "unknown";
  report_date: string;
  calls_processed: number;
  calls_skipped_duplicate: number;
  calls_skipped_internal: number;
  team_members_matched: number;
  prospects_matched: number;
  contact_activities_inserted: number;
  metrics_upserted: number;
  row_errors: number;
  error?: string;
}

async function processXlsxBuffer(
  buffer: Uint8Array,
  supabase: SupabaseClient,
  lookups: AgencyLookups,
): Promise<XlsxProcessResult> {
  const agencyId = lookups.agencyId;

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "array", raw: true });
  } catch (err) {
    return {
      success: false, file_type: "unknown", report_date: "", calls_processed: 0,
      calls_skipped_duplicate: 0, calls_skipped_internal: 0, team_members_matched: 0,
      prospects_matched: 0, contact_activities_inserted: 0, metrics_upserted: 0, row_errors: 0,
      error: `Failed to parse Excel: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const sheetNames = workbook.SheetNames;
  const hasCalls = sheetNames.includes("Calls");
  const hasUsers = sheetNames.includes("Users");

  if (!hasCalls && !hasUsers) {
    return {
      success: false, file_type: "unknown", report_date: "", calls_processed: 0,
      calls_skipped_duplicate: 0, calls_skipped_internal: 0, team_members_matched: 0,
      prospects_matched: 0, contact_activities_inserted: 0, metrics_upserted: 0, row_errors: 0,
      error: `Unrecognized file: no 'Calls' or 'Users' sheet found (found: ${sheetNames.join(", ")})`,
    };
  }

  const fileType = hasCalls ? "calls" : "users";
  let reportDate = extractReportDateFromFilters(workbook);
  if (!reportDate) {
    reportDate = new Date().toISOString().split("T")[0];
    console.log(`[ringcentral-report-ingest] No report date in Filters, using today: ${reportDate}`);
  }

  let callsProcessed = 0;
  let callsSkippedDuplicate = 0;
  let callsSkippedInternal = 0;
  let rowErrors = 0;
  const matchedTeamMemberIds = new Set<string>();
  let prospectsMatched = 0;
  let contactActivitiesInserted = 0;

  if (hasCalls) {
    const callsSheet = workbook.Sheets["Calls"];
    const callsData = XLSX.utils.sheet_to_json(callsSheet, { raw: true }) as Record<string, unknown>[];
    console.log(`[ringcentral-report-ingest] Processing ${callsData.length} call rows`);

    for (const row of callsData) {
      try {
        const direction = String(getCol(row, "Call Direction", "Call Direct", "Direction", "direction") || "").trim();
        if (direction.toLowerCase() === "internal") { callsSkippedInternal++; continue; }
        if (!direction || !["inbound", "outbound"].includes(direction.toLowerCase())) continue;

        const sessionId = String(getCol(row, "Session Id", "Session ID", "session_id") || "").trim();
        if (!sessionId) continue;

        const fromName = extractCallerName(String(getCol(row, "From Name", "From Nam") || ""));
        const toName = extractCallerName(String(getCol(row, "To Name") || ""));
        const fromNumber = normalizePhone(String(getCol(row, "From Number", "From Num", "From Numb") || ""));
        const toNumber = normalizePhone(String(getCol(row, "To Number", "To Numbe") || ""));
        const result = String(getCol(row, "Result", "result") || "").trim();
        const callLength = getCol(row, "Call Length", "Call Lengt");
        const callStartTime = getCol(row, "Call Start Time", "Call Start", "Call Start Ti");

        const dirLower = direction.toLowerCase() as "inbound" | "outbound";
        const agentName = dirLower === "outbound" ? fromName : toName;
        const matchedTeamMemberId = matchTeamMember(lookups, agentName);
        if (matchedTeamMemberId) matchedTeamMemberIds.add(matchedTeamMemberId);

        const prospectPhone = dirLower === "outbound" ? toNumber : fromNumber;
        const normalizedProspectPhone = normalizePhone(prospectPhone);

        let matchedProspectId: string | null = null;
        if (normalizedProspectPhone) {
          matchedProspectId = lookups.householdByPhone.get(normalizedProspectPhone) || null;
          if (matchedProspectId) prospectsMatched++;
        }

        let matchedContactId: string | null = null;
        if (normalizedProspectPhone) {
          matchedContactId = lookups.contactByPhone.get(normalizedProspectPhone) || null;
        }

        const { data: existing } = await supabase
          .from("call_events").select("id")
          .eq("provider", "ringcentral").eq("external_call_id", sessionId)
          .maybeSingle();
        if (existing) { callsSkippedDuplicate++; continue; }

        let callStartedAt: string | null = null;
        if (callStartTime) {
          if (typeof callStartTime === "number") {
            const date = XLSX.SSF.parse_date_code(callStartTime);
            if (date) {
              callStartedAt = new Date(date.y, date.m - 1, date.d, date.H || 0, date.M || 0, date.S || 0).toISOString();
            }
          } else if (typeof callStartTime === "string") {
            const parsed = new Date(callStartTime);
            if (!isNaN(parsed.getTime())) callStartedAt = parsed.toISOString();
          }
        }

        const durationSeconds = parseDuration(callLength);

        const { data: insertedCall, error: insertError } = await supabase
          .from("call_events")
          .insert({
            agency_id: agencyId, provider: "ringcentral", external_call_id: sessionId,
            direction: dirLower, from_number: fromNumber || null, to_number: toNumber || null,
            duration_seconds: durationSeconds, call_started_at: callStartedAt, call_ended_at: null,
            result: result || null, extension_name: agentName,
            matched_team_member_id: matchedTeamMemberId, matched_prospect_id: matchedProspectId,
            raw_payload: row,
          })
          .select("id").single();

        if (insertError) {
          console.error(`[ringcentral-report-ingest] Insert error for session ${sessionId}:`, insertError);
          rowErrors++;
          continue;
        }

        callsProcessed++;

        if (matchedContactId && insertedCall?.id) {
          try {
            const activityType = dirLower === "outbound" ? "call_outbound" : "call_inbound";
            await supabase.from("contact_activities").insert({
              agency_id: agencyId, contact_id: matchedContactId, source_module: "phone_system",
              activity_type: activityType, phone_number: normalizedProspectPhone,
              call_direction: dirLower, call_duration_seconds: durationSeconds,
              subject: `${direction} Call`,
              notes: `${dirLower} call - ${durationSeconds}s via RingCentral report`,
              call_event_id: insertedCall.id,
            });
            contactActivitiesInserted++;
          } catch (caErr) {
            console.error(`[ringcentral-report-ingest] Contact activity insert error:`, caErr);
          }
        }
      } catch (rowErr) {
        console.error(`[ringcentral-report-ingest] Row processing error:`, rowErr);
        rowErrors++;
      }
    }
  }

  let metricsUpserted = 0;
  if (hasUsers) {
    const usersSheet = workbook.Sheets["Users"];
    const usersData = XLSX.utils.sheet_to_json(usersSheet, { raw: true }) as Record<string, unknown>[];
    console.log(`[ringcentral-report-ingest] Processing ${usersData.length} user rows`);

    for (const row of usersData) {
      try {
        const userName = String(getCol(row, "Name", "name") || "").trim();
        if (!userName) continue;
        const teamMemberId = matchTeamMember(lookups, userName);
        if (!teamMemberId) continue;

        const totalHandleTime = getCol(row, "Total Handle Time", "total_handle_time");
        const totalHandleSeconds = parseDuration(totalHandleTime);
        const inboundCalls = Number(getCol(row, "# Inbound", "# Inbounc", "Inbound Calls", "inbound_calls") || 0);
        const outboundCalls = Number(getCol(row, "# Outbound", "# Outboun", "# Outbou", "Outbound Calls", "outbound_calls") || 0);
        const totalCalls = Number(getCol(row, "Total Calls", "total_calls") || (inboundCalls + outboundCalls));

        const { error: upsertError } = await supabase
          .from("call_metrics_daily")
          .upsert({
            agency_id: agencyId, team_member_id: teamMemberId, date: reportDate,
            total_calls: totalCalls, inbound_calls: inboundCalls, outbound_calls: outboundCalls,
            answered_calls: 0, missed_calls: 0, total_talk_seconds: totalHandleSeconds,
            last_calculated_at: new Date().toISOString(), updated_at: new Date().toISOString(),
          }, { onConflict: "agency_id,team_member_id,date" });

        if (upsertError) {
          console.error(`[ringcentral-report-ingest] Metrics upsert error for ${userName}:`, upsertError);
        } else {
          metricsUpserted++;
        }
      } catch (userErr) {
        console.error(`[ringcentral-report-ingest] User row error:`, userErr);
      }
    }
  }

  return {
    success: true, file_type: fileType as "calls" | "users",
    report_date: reportDate, calls_processed: callsProcessed,
    calls_skipped_duplicate: callsSkippedDuplicate, calls_skipped_internal: callsSkippedInternal,
    team_members_matched: matchedTeamMemberIds.size, prospects_matched: prospectsMatched,
    contact_activities_inserted: contactActivitiesInserted, metrics_upserted: metricsUpserted,
    row_errors: rowErrors,
  };
}

// ─── Mailgun signature verification ───

async function verifyMailgunSignature(timestamp: string, token: string, signature: string): Promise<boolean> {
  const signingKey = Deno.env.get("MAILGUN_SIGNING_KEY");
  if (!signingKey) {
    console.error("[ringcentral-report-ingest] MAILGUN_SIGNING_KEY not set");
    return false;
  }

  // Reject timestamps older than 5 minutes to prevent replay attacks
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts) || Math.abs(Date.now() / 1000 - ts) > 300) {
    console.error("[ringcentral-report-ingest] Mailgun timestamp too old or invalid");
    return false;
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(signingKey), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const data = encoder.encode(timestamp + token);
  const sig = await crypto.subtle.sign("HMAC", key, data);
  const hexSig = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");

  return hexSig === signature;
}

// ─── Route B: Mailgun webhook handler ───

async function handleMailgunRoute(req: Request): Promise<Response> {
  const startTime = Date.now();

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch (err) {
    console.error("[ringcentral-report-ingest] Failed to parse form data:", err);
    return new Response(JSON.stringify({ error: "Invalid form data" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // a. Mailgun signature verification
  const mgTimestamp = formData.get("timestamp") as string || "";
  const mgToken = formData.get("token") as string || "";
  const mgSignature = formData.get("signature") as string || "";

  if (!mgTimestamp || !mgToken || !mgSignature) {
    console.error("[ringcentral-report-ingest] Missing Mailgun signature fields");
    return new Response(JSON.stringify({ error: "Missing signature" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const validSig = await verifyMailgunSignature(mgTimestamp, mgToken, mgSignature);
  if (!validSig) {
    console.error("[ringcentral-report-ingest] Invalid Mailgun signature");
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Extract email metadata
  const sender = (formData.get("sender") as string) || (formData.get("from") as string) || "";
  const recipient = (formData.get("recipient") as string) || "";
  const subject = (formData.get("subject") as string) || "";
  const messageId = (formData.get("Message-Id") as string) || (formData.get("message-id") as string) || "";
  const attachmentCount = parseInt(formData.get("attachment-count") as string || "0", 10);

  console.log(`[ringcentral-report-ingest] Mailgun email: from=${sender}, to=${recipient}, subject="${subject}", attachments=${attachmentCount}`);

  // b. Agency resolution from recipient email
  const keyMatch = recipient.match(/^calls-([a-z0-9]+)@/i);
  if (!keyMatch) {
    console.warn(`[ringcentral-report-ingest] Unrecognized recipient format: ${recipient}`);
    await supabase.from("email_ingest_logs").insert({
      agency_id: null, sender, recipient, subject, message_id: messageId || null,
      status: "rejected", attachment_count: attachmentCount,
      error_message: `Unrecognized recipient: ${recipient}`,
      processing_duration_ms: Date.now() - startTime,
    });
    return new Response(JSON.stringify({ status: "rejected", reason: "unrecognized recipient" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const ingestKey = keyMatch[1];

  const { data: agency } = await supabase
    .from("agencies")
    .select("id")
    .eq("rc_ingest_key", ingestKey)
    .maybeSingle();

  if (!agency) {
    console.warn(`[ringcentral-report-ingest] No agency found for ingest key: ${ingestKey}`);
    await supabase.from("email_ingest_logs").insert({
      agency_id: null, sender, recipient, subject, message_id: messageId || null,
      status: "rejected", attachment_count: attachmentCount,
      error_message: `No agency found for key: ${ingestKey}`,
      processing_duration_ms: Date.now() - startTime,
    });
    return new Response(JSON.stringify({ status: "rejected", reason: "unknown key" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const agencyId = agency.id;

  // c. Dedup check by Message-Id
  if (messageId) {
    const { data: existingLog } = await supabase
      .from("email_ingest_logs")
      .select("id")
      .eq("message_id", messageId)
      .maybeSingle();

    if (existingLog) {
      console.log(`[ringcentral-report-ingest] Duplicate message-id: ${messageId}`);
      return new Response(JSON.stringify({ status: "duplicate" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // d. Process attachments
  if (attachmentCount === 0) {
    await supabase.from("email_ingest_logs").insert({
      agency_id: agencyId, sender, recipient, subject, message_id: messageId || null,
      status: "failed", attachment_count: 0, files_processed: 0,
      error_message: "No attachments found",
      processing_duration_ms: Date.now() - startTime,
    });
    return new Response(JSON.stringify({ status: "no_attachments" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Load agency lookups once for all attachments
  const lookups = await loadAgencyLookups(supabase, agencyId);

  const fileResults: Record<string, unknown>[] = [];
  let filesProcessed = 0;
  let anySuccess = false;
  let anyError = false;

  for (let i = 1; i <= attachmentCount; i++) {
    const attachment = formData.get(`attachment-${i}`) as File | null;
    if (!attachment) {
      fileResults.push({ index: i, status: "missing", error: `attachment-${i} not found in form data` });
      continue;
    }

    const fileName = attachment.name || `attachment-${i}`;
    const ext = fileName.split(".").pop()?.toLowerCase() || "";

    // File size check
    if (attachment.size > MAX_ATTACHMENT_BYTES) {
      fileResults.push({ index: i, file: fileName, status: "skipped", error: `File too large (${(attachment.size / 1024 / 1024).toFixed(1)} MB > 10 MB limit)` });
      anyError = true;
      continue;
    }

    if (ext === "xlsx" || ext === "xls") {
      try {
        const buffer = new Uint8Array(await attachment.arrayBuffer());
        const result = await processXlsxBuffer(buffer, supabase, lookups);
        fileResults.push({ index: i, file: fileName, type: "xlsx", ...result });
        if (result.success) { filesProcessed++; anySuccess = true; }
        else { anyError = true; }
      } catch (err) {
        fileResults.push({ index: i, file: fileName, type: "xlsx", status: "error", error: err instanceof Error ? err.message : String(err) });
        anyError = true;
      }
    } else {
      fileResults.push({ index: i, file: fileName, status: "skipped", error: `Unsupported file type: .${ext}` });
    }
  }

  // e. Log results
  const status = anySuccess && !anyError ? "success" : anySuccess && anyError ? "partial" : "failed";

  await supabase.from("email_ingest_logs").insert({
    agency_id: agencyId, sender, recipient, subject, message_id: messageId || null,
    status, attachment_count: attachmentCount, files_processed: filesProcessed,
    processing_results: fileResults,
    processed_at: new Date().toISOString(),
    processing_duration_ms: Date.now() - startTime,
  });

  console.log(`[ringcentral-report-ingest] Mailgun complete: status=${status}, files=${filesProcessed}/${attachmentCount}`);

  // f. Always return 200 (Mailgun retries on non-200)
  return new Response(
    JSON.stringify({ status, files_processed: filesProcessed, results: fileResults }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

// ─── Main handler ───

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const contentType = req.headers.get("content-type") || "";

    // Route B (Mailgun) — multipart/form-data
    if (contentType.includes("multipart/form-data")) {
      return await handleMailgunRoute(req);
    }

    // Route A (Manual Upload) — JSON body
    const body = await req.json();
    const { agency_id, storage_path } = body;

    if (!agency_id) {
      return new Response(
        JSON.stringify({ error: "Missing required field: agency_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(agency_id)) {
      return new Response(
        JSON.stringify({ error: "Invalid agency_id format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!storage_path) {
      return new Response(
        JSON.stringify({ error: "Missing required field: storage_path" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`[ringcentral-report-ingest] Processing report for agency ${agency_id}: ${storage_path}`);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: fileData, error: downloadError } = await supabase.storage
      .from("rc-reports")
      .download(storage_path);

    if (downloadError || !fileData) {
      console.error("[ringcentral-report-ingest] Download error:", downloadError);
      return new Response(
        JSON.stringify({ error: "File not found", details: downloadError?.message }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);
    const lookups = await loadAgencyLookups(supabase, agency_id);
    const result = await processXlsxBuffer(buffer, supabase, lookups);

    if (!result.success) {
      return new Response(
        JSON.stringify({ error: result.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`[ringcentral-report-ingest] Complete (${result.file_type}): calls=${result.calls_processed}, dupes=${result.calls_skipped_duplicate}, internal=${result.calls_skipped_internal}, metrics=${result.metrics_upserted}`);

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (error) {
    console.error("[ringcentral-report-ingest] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
