import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import * as XLSX from "https://esm.sh/xlsx@0.18.5/xlsx.mjs";

/**
 * Normalize phone number: strip non-digits, remove leading 1 if 11 digits
 */
function normalizePhone(phone: string | number | null | undefined): string | null {
  if (!phone && phone !== 0) return null;
  const str = String(phone);
  const digits = str.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.substring(1);
  if (digits.length === 10) return digits;
  return digits || null;
}

/**
 * Parse caller name from format "9013 - SB JOSEPH" → "SB JOSEPH"
 * Also handles "INFERNO", "Marketing ..." etc. by returning as-is
 */
function extractCallerName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const dashIndex = trimmed.indexOf(" - ");
  if (dashIndex !== -1) {
    return trimmed.substring(dashIndex + 3).trim() || trimmed;
  }
  return trimmed;
}

/**
 * Parse duration from SheetJS raw value.
 * - If number (fractional days from Excel): Math.round(value * 86400)
 * - If string "HH:MM:SS" or "H:MM:SS": parse to seconds
 * - If null/empty: 0
 */
function parseDuration(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;

  if (typeof value === "number") {
    return Math.round(value * 86400);
  }

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

/**
 * Parse report date from the Filters sheet.
 * Looks for "From Time" column value.
 * Expected format: "MM/DD/YYYY 12:00:00 AM" or Excel serial date number
 */
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

/**
 * Extract report date from a Filters sheet present in either file type.
 */
function extractReportDateFromFilters(workbook: XLSX.WorkBook): string | null {
  if (!workbook.SheetNames.includes("Filters")) return null;

  const filtersSheet = workbook.Sheets["Filters"];
  const filtersData = XLSX.utils.sheet_to_json(filtersSheet, { raw: true }) as Record<string, unknown>[];
  for (const row of filtersData) {
    const fromTime = row["From Time"] || row["from_time"] || row["From time"];
    if (fromTime) {
      return parseReportDate(fromTime);
    }
  }
  return null;
}

/**
 * Helper to get a row value trying multiple possible column names
 */
function getCol(row: Record<string, unknown>, ...names: string[]): unknown {
  for (const n of names) {
    if (row[n] !== undefined && row[n] !== null) return row[n];
  }
  return undefined;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const contentType = req.headers.get("content-type") || "";

    // Route B (Mailgun) — Stub only
    if (contentType.includes("multipart/form-data")) {
      console.log("[ringcentral-report-ingest] Mailgun route not yet implemented");
      return new Response(
        JSON.stringify({ error: "Mailgun ingest route not yet implemented" }),
        { status: 501, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Route A (Manual Upload) — accepts one file at a time
    // The email has two attachments; user uploads each separately (or both via UI)
    const body = await req.json();
    const { agency_id, storage_path } = body;

    if (!agency_id) {
      return new Response(
        JSON.stringify({ error: "Missing required field: agency_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(agency_id)) {
      return new Response(
        JSON.stringify({ error: "Invalid agency_id format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!storage_path) {
      return new Response(
        JSON.stringify({ error: "Missing required field: storage_path" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[ringcentral-report-ingest] Processing report for agency ${agency_id}: ${storage_path}`);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("rc-reports")
      .download(storage_path);

    if (downloadError || !fileData) {
      console.error("[ringcentral-report-ingest] Download error:", downloadError);
      return new Response(
        JSON.stringify({ error: "File not found", details: downloadError?.message }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse Excel
    let workbook: XLSX.WorkBook;
    try {
      const arrayBuffer = await fileData.arrayBuffer();
      workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: "array", raw: true });
    } catch (err) {
      console.error("[ringcentral-report-ingest] Excel parse error:", err);
      return new Response(
        JSON.stringify({ error: "Failed to parse Excel file", details: err instanceof Error ? err.message : String(err) }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sheetNames = workbook.SheetNames;
    const hasCalls = sheetNames.includes("Calls");
    const hasUsers = sheetNames.includes("Users");

    if (!hasCalls && !hasUsers) {
      return new Response(
        JSON.stringify({ error: "Unrecognized file: no 'Calls' or 'Users' sheet found", sheets_found: sheetNames }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Detect file type
    const fileType = hasCalls ? "calls" : "users";
    console.log(`[ringcentral-report-ingest] Detected file type: ${fileType}, sheets: ${sheetNames.join(", ")}`);

    // Extract report date from Filters sheet (both files have one)
    let reportDate = extractReportDateFromFilters(workbook);
    if (!reportDate) {
      reportDate = new Date().toISOString().split("T")[0];
      console.log(`[ringcentral-report-ingest] No report date in Filters, using today: ${reportDate}`);
    } else {
      console.log(`[ringcentral-report-ingest] Report date: ${reportDate}`);
    }

    // Load lookup data for the agency
    const [teamResult, householdsResult, contactsResult] = await Promise.all([
      supabase
        .from("team_members")
        .select("id, name, email")
        .eq("agency_id", agency_id),
      supabase
        .from("lqs_households")
        .select("id, phone")
        .eq("agency_id", agency_id)
        .not("phone", "is", null),
      supabase
        .from("agency_contacts")
        .select("id, phones")
        .eq("agency_id", agency_id),
    ]);

    const teamMembers = teamResult.data || [];
    const households = householdsResult.data || [];
    const contacts = contactsResult.data || [];

    console.log(`[ringcentral-report-ingest] Loaded ${teamMembers.length} team members, ${households.length} households, ${contacts.length} contacts`);

    // Build lookup maps
    const teamByName = new Map<string, string>();
    for (const tm of teamMembers) {
      if (tm.name) teamByName.set(tm.name.toLowerCase(), tm.id);
    }

    const householdByPhone = new Map<string, string>();
    for (const h of households) {
      const norm = normalizePhone(h.phone);
      if (norm) householdByPhone.set(norm, h.id);
    }

    const contactByPhone = new Map<string, string>();
    for (const c of contacts) {
      if (c.phones && Array.isArray(c.phones)) {
        for (const p of c.phones) {
          const norm = normalizePhone(p);
          if (norm) contactByPhone.set(norm, c.id);
        }
      }
    }

    // Helper: match team member by name with exact then partial fallback
    function matchTeamMember(name: string | null): string | null {
      if (!name) return null;
      const nameLower = name.toLowerCase();
      const exact = teamByName.get(nameLower);
      if (exact) return exact;
      // Partial match
      for (const [tmName, tmId] of teamByName) {
        if (tmName.includes(nameLower) || nameLower.includes(tmName)) {
          return tmId;
        }
      }
      return null;
    }

    // ─── CALLS FILE ───
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
          // Column: "Call Direction" (actual RC export name)
          const direction = String(
            getCol(row, "Call Direction", "Call Direct", "Direction", "direction") || ""
          ).trim();

          if (direction.toLowerCase() === "internal") {
            callsSkippedInternal++;
            continue;
          }

          if (!direction || !["inbound", "outbound"].includes(direction.toLowerCase())) {
            continue;
          }

          // Column: "Session Id"
          const sessionId = String(
            getCol(row, "Session Id", "Session ID", "session_id") || ""
          ).trim();
          if (!sessionId) continue;

          // Columns: "From Name", "To Name" — may have queue prefix like "9013 - SB..."
          const fromName = extractCallerName(
            String(getCol(row, "From Name", "From Nam") || "")
          );
          const toName = extractCallerName(
            String(getCol(row, "To Name") || "")
          );

          // Columns: "From Number", "To Number" — formatted like "(570) 209-9013"
          const fromNumber = String(getCol(row, "From Number", "From Num", "From Numb") || "").trim();
          const toNumber = String(getCol(row, "To Number", "To Numbe") || "").trim();

          const result = String(getCol(row, "Result", "result") || "").trim();

          // Column: "Call Length" (e.g. "00:01:42" or raw number)
          const callLength = getCol(row, "Call Length", "Call Lengt");

          // Column: "Handle Time" (talk time portion)
          // const handleTime = getCol(row, "Handle Time", "Handle Ti");

          // Column: "Call Start Time" — e.g. "02/04/2026" or date serial
          const callStartTime = getCol(row, "Call Start Time", "Call Start", "Call Start Ti");

          // Column: "Queue" — for reference
          // const queue = String(getCol(row, "Queue") || "").trim();

          const dirLower = direction.toLowerCase() as "inbound" | "outbound";

          // Agent name: Outbound → From Name, Inbound → To Name
          const agentName = dirLower === "outbound" ? fromName : toName;
          const matchedTeamMemberId = matchTeamMember(agentName);

          if (matchedTeamMemberId) {
            matchedTeamMemberIds.add(matchedTeamMemberId);
          }

          // Prospect phone: Outbound → To Number, Inbound → From Number
          const prospectPhone = dirLower === "outbound" ? toNumber : fromNumber;
          const normalizedProspectPhone = normalizePhone(prospectPhone);

          // Lookup 1 — lqs_households → call_events.matched_prospect_id
          let matchedProspectId: string | null = null;
          if (normalizedProspectPhone) {
            matchedProspectId = householdByPhone.get(normalizedProspectPhone) || null;
            if (matchedProspectId) prospectsMatched++;
          }

          // Lookup 2 — agency_contacts → contact_activities.contact_id
          let matchedContactId: string | null = null;
          if (normalizedProspectPhone) {
            matchedContactId = contactByPhone.get(normalizedProspectPhone) || null;
          }

          // Dedup
          const { data: existing } = await supabase
            .from("call_events")
            .select("id")
            .eq("provider", "ringcentral")
            .eq("external_call_id", sessionId)
            .maybeSingle();

          if (existing) {
            callsSkippedDuplicate++;
            continue;
          }

          // Parse call start time
          let callStartedAt: string | null = null;
          if (callStartTime) {
            if (typeof callStartTime === "number") {
              const date = XLSX.SSF.parse_date_code(callStartTime);
              if (date) {
                callStartedAt = new Date(
                  date.y, date.m - 1, date.d, date.H || 0, date.M || 0, date.S || 0
                ).toISOString();
              }
            } else if (typeof callStartTime === "string") {
              const parsed = new Date(callStartTime);
              if (!isNaN(parsed.getTime())) {
                callStartedAt = parsed.toISOString();
              }
            }
          }

          const durationSeconds = parseDuration(callLength);

          // Insert call_events
          const { data: insertedCall, error: insertError } = await supabase
            .from("call_events")
            .insert({
              agency_id,
              provider: "ringcentral",
              external_call_id: sessionId,
              direction: dirLower,
              from_number: fromNumber || null,
              to_number: toNumber || null,
              duration_seconds: durationSeconds,
              call_started_at: callStartedAt,
              call_ended_at: null,
              result: result || null,
              extension_name: agentName,
              matched_team_member_id: matchedTeamMemberId,
              matched_prospect_id: matchedProspectId,
              raw_payload: row,
            })
            .select("id")
            .single();

          if (insertError) {
            console.error(`[ringcentral-report-ingest] Insert error for session ${sessionId}:`, insertError);
            rowErrors++;
            continue;
          }

          callsProcessed++;

          // Insert contact_activities if agency_contact matched
          if (matchedContactId && insertedCall?.id) {
            try {
              const activityType = dirLower === "outbound" ? "call_outbound" : "call_inbound";
              await supabase
                .from("contact_activities")
                .insert({
                  agency_id,
                  contact_id: matchedContactId,
                  source_module: "phone_system",
                  activity_type: activityType,
                  phone_number: normalizedProspectPhone,
                  call_direction: dirLower,
                  call_duration_seconds: durationSeconds,
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

    // ─── USERS FILE ───
    let metricsUpserted = 0;
    if (hasUsers) {
      const usersSheet = workbook.Sheets["Users"];
      const usersData = XLSX.utils.sheet_to_json(usersSheet, { raw: true }) as Record<string, unknown>[];
      console.log(`[ringcentral-report-ingest] Processing ${usersData.length} user rows`);

      for (const row of usersData) {
        try {
          const userName = String(getCol(row, "Name", "name") || "").trim();
          if (!userName) continue;

          const teamMemberId = matchTeamMember(userName);
          if (!teamMemberId) continue;

          // Actual RC column names: "Total Handle Time", "Total Calls", "# Inbound", "# Outbound"
          const totalHandleTime = getCol(row, "Total Handle Time", "total_handle_time");
          const totalHandleSeconds = parseDuration(totalHandleTime);

          const inboundCalls = Number(getCol(row, "# Inbound", "# Inbounc", "Inbound Calls", "inbound_calls") || 0);
          const outboundCalls = Number(getCol(row, "# Outbound", "# Outboun", "# Outbou", "Outbound Calls", "outbound_calls") || 0);
          const totalCalls = Number(getCol(row, "Total Calls", "total_calls") || (inboundCalls + outboundCalls));
          // answered/missed not in Users report — leave as 0
          const answeredCalls = 0;
          const missedCalls = 0;

          const { error: upsertError } = await supabase
            .from("call_metrics_daily")
            .upsert({
              agency_id,
              team_member_id: teamMemberId,
              date: reportDate,
              total_calls: totalCalls,
              inbound_calls: inboundCalls,
              outbound_calls: outboundCalls,
              answered_calls: answeredCalls,
              missed_calls: missedCalls,
              total_talk_seconds: totalHandleSeconds,
              last_calculated_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }, {
              onConflict: "agency_id,team_member_id,date",
            });

          if (upsertError) {
            console.error(`[ringcentral-report-ingest] Metrics upsert error for ${userName}:`, upsertError);
          } else {
            metricsUpserted++;
            console.log(`[ringcentral-report-ingest] Upserted metrics for ${userName}: ${totalCalls} calls, ${totalHandleSeconds}s handle time`);
          }
        } catch (userErr) {
          console.error(`[ringcentral-report-ingest] User row error:`, userErr);
        }
      }
    }

    console.log(`[ringcentral-report-ingest] Complete (${fileType}): calls=${callsProcessed}, dupes=${callsSkippedDuplicate}, internal=${callsSkippedInternal}, metrics=${metricsUpserted}`);

    return new Response(
      JSON.stringify({
        success: true,
        file_type: fileType,
        report_date: reportDate,
        calls_processed: callsProcessed,
        calls_skipped_duplicate: callsSkippedDuplicate,
        calls_skipped_internal: callsSkippedInternal,
        team_members_matched: matchedTeamMemberIds.size,
        prospects_matched: prospectsMatched,
        contact_activities_inserted: contactActivitiesInserted,
        metrics_upserted: metricsUpserted,
        row_errors: rowErrors,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[ringcentral-report-ingest] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
