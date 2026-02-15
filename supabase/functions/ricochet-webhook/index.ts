import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";

interface RicochetPayload {
  id: string;
  phone: string;
  to: string;
  outbound: boolean;
  Duration: number;
  created_at: string;
  answered_at: string | null;
  "User's name": string;
  "User's email": string;
}

/**
 * Validate and sanitize a timestamp string for PostgreSQL timestamptz.
 * Returns the original string if valid, or the fallback value if invalid/missing.
 * Catches garbage values like "-0001-11-30" that Ricochet may send for null dates.
 */
function safeTimestamp(value: string | null | undefined, fallback: string | null): string | null {
  if (!value || typeof value !== "string" || value.trim() === "") return fallback;
  const d = new Date(value);
  // Invalid date, or year out of reasonable range (postgres timestamptz supports 4713 BC–294276 AD
  // but call data should never predate ~2000)
  if (isNaN(d.getTime()) || d.getFullYear() < 2000 || d.getFullYear() > 2100) {
    console.warn(`[ricochet-webhook] Invalid timestamp rejected: "${value}"`);
    return fallback;
  }
  return value;
}

/**
 * Normalize phone number: strip non-digits, remove leading 1 if 11 digits
 */
function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return digits.substring(1);
  }
  return digits || null;
}

/**
 * Match team member by email (case-insensitive) or name, returning id + name
 */
async function matchTeamMember(
  supabase: SupabaseClient,
  agencyId: string,
  userName: string | null,
  userEmail: string | null
): Promise<{ id: string; name: string } | null> {
  const trimmedEmail = userEmail?.trim() || null;
  const trimmedName = userName?.trim() || null;

  if (!trimmedName && !trimmedEmail) {
    console.log(`[ricochet-webhook] matchTeamMember: no name or email provided`);
    return null;
  }

  // Try matching by email first (most reliable identifier)
  if (trimmedEmail) {
    const { data: byEmail, error: emailErr } = await supabase
      .from("team_members")
      .select("id, name")
      .eq("agency_id", agencyId)
      .ilike("email", trimmedEmail)
      .limit(1)
      .maybeSingle();

    if (emailErr) {
      console.error(`[ricochet-webhook] matchTeamMember email query error:`, emailErr.message);
    }
    if (byEmail?.id) {
      console.log(`[ricochet-webhook] Matched team member by email: ${trimmedEmail} -> ${byEmail.id}`);
      return { id: byEmail.id, name: byEmail.name };
    }
  }

  // Fallback: try matching by name (case-insensitive)
  if (trimmedName) {
    const { data: byName, error: nameErr } = await supabase
      .from("team_members")
      .select("id, name")
      .eq("agency_id", agencyId)
      .ilike("name", trimmedName)
      .limit(1)
      .maybeSingle();

    if (nameErr) {
      console.error(`[ricochet-webhook] matchTeamMember name query error:`, nameErr.message);
    }
    if (byName?.id) {
      console.log(`[ricochet-webhook] Matched team member by name: ${trimmedName} -> ${byName.id}`);
      return { id: byName.id, name: byName.name };
    }
  }

  console.warn(`[ricochet-webhook] No team member match for agency=${agencyId} email=${trimmedEmail} name=${trimmedName}`);
  return null;
}

/**
 * Match prospect by phone number in lqs_households
 * Returns the matched household id and which phone field matched (for determining customer number)
 */
async function matchProspect(
  supabase: SupabaseClient,
  agencyId: string,
  phoneNumber: string | null,
  toNumber: string | null
): Promise<{ prospectId: string | null; customerPhone: string | null }> {
  const normalizedPhone = normalizePhone(phoneNumber);
  const normalizedTo = normalizePhone(toNumber);

  if (!normalizedPhone && !normalizedTo) {
    return { prospectId: null, customerPhone: null };
  }

  // Query households that match either phone number
  const phonesToCheck = [normalizedPhone, normalizedTo].filter(Boolean) as string[];

  // Get all households for this agency with a phone number
  const { data: households } = await supabase
    .from("lqs_households")
    .select("id, phone")
    .eq("agency_id", agencyId)
    .not("phone", "is", null);

  if (!households?.length) {
    return { prospectId: null, customerPhone: null };
  }

  // Check each household's normalized phone against our numbers
  for (const household of households) {
    const householdPhone = normalizePhone(household.phone);
    if (householdPhone && phonesToCheck.includes(householdPhone)) {
      // Determine which original phone field was the customer's
      const customerPhone = normalizedPhone === householdPhone ? phoneNumber : toNumber;
      return { prospectId: household.id, customerPhone };
    }
  }

  return { prospectId: null, customerPhone: null };
}

/**
 * Insert contact activity for a prospect
 */
async function insertContactActivity(
  supabase: SupabaseClient,
  agencyId: string,
  prospectId: string,
  teamMemberId: string | null,
  direction: string,
  durationSeconds: number,
  externalCallId: string,
  occurredAt: string
): Promise<void> {
  const activityType = direction === "Outbound" ? "call_outbound" : "call_inbound";
  const directionLabel = direction.toLowerCase();

  await supabase
    .from("contact_activities")
    .insert({
      agency_id: agencyId,
      contact_type: "prospect",
      prospect_id: prospectId,
      activity_type: activityType,
      activity_source: "ricochet",
      title: `${direction} Call`,
      description: `${directionLabel} call - ${durationSeconds}s`,
      metadata: {
        duration_seconds: durationSeconds,
        provider: "ricochet",
        external_call_id: externalCallId,
        team_member_id: teamMemberId,
      },
      occurred_at: occurredAt,
    });
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only accept POST requests
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Get agency_id from query param
    const url = new URL(req.url);
    const agencyId = url.searchParams.get("agency_id");

    if (!agencyId) {
      return new Response(
        JSON.stringify({ error: "Missing agency_id query parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(agencyId)) {
      return new Response(
        JSON.stringify({ error: "Invalid agency_id format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const payload: RicochetPayload = await req.json();
    console.log(`[ricochet-webhook] Received call for agency ${agencyId}:`, payload.id);

    // Validate required fields
    if (!payload.id) {
      return new Response(
        JSON.stringify({ error: "Missing required field: id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create service role client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check for duplicate (dedup by provider + external_call_id)
    const { data: existing } = await supabase
      .from("call_events")
      .select("id")
      .eq("provider", "ricochet")
      .eq("external_call_id", payload.id)
      .single();

    if (existing) {
      console.log(`[ricochet-webhook] Duplicate call skipped: ${payload.id}`);
      return new Response(
        JSON.stringify({
          success: true,
          call_id: existing.id,
          duplicate: true,
          matched_team_member: false,
          matched_prospect: false
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Match team member
    const userName = payload["User's name"] || null;
    const userEmail = payload["User's email"] || null;
    const matchedMember = await matchTeamMember(supabase, agencyId, userName, userEmail);
    const matchedTeamMemberId = matchedMember?.id ?? null;

    // Match prospect
    const { prospectId: matchedProspectId } = await matchProspect(
      supabase,
      agencyId,
      payload.phone,
      payload.to
    );

    // Determine direction
    const direction = payload.outbound ? "Outbound" : "Inbound";

    // Validate timestamps — fall back to now() for created_at if Ricochet sends garbage like "-0001-11-30"
    const now = new Date().toISOString();
    const callStartedAt = safeTimestamp(payload.created_at, now) ?? now;

    // Insert call event
    const { data: insertedCall, error: insertError } = await supabase
      .from("call_events")
      .insert({
        agency_id: agencyId,
        provider: "ricochet",
        external_call_id: payload.id,
        direction: direction,
        from_number: payload.phone,
        to_number: payload.to,
        duration_seconds: payload.Duration || 0,
        call_started_at: callStartedAt,
        call_ended_at: null,
        result: "completed",
        extension_name: matchedMember?.name ?? userName,
        matched_team_member_id: matchedTeamMemberId,
        matched_prospect_id: matchedProspectId,
        raw_payload: payload,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error(`[ricochet-webhook] Insert error:`, insertError);
      return new Response(
        JSON.stringify({ error: "Failed to insert call event", details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[ricochet-webhook] Inserted call: ${insertedCall.id}`);

    // call_metrics_daily is now aggregated by DB trigger
    // trg_call_events_aggregate_daily (migration 20260211200000)

    // Post-insert: Add contact activity if prospect matched
    if (matchedProspectId) {
      try {
        await insertContactActivity(
          supabase,
          agencyId,
          matchedProspectId,
          matchedTeamMemberId,
          direction,
          payload.Duration || 0,
          payload.id,
          callStartedAt
        );
        console.log(`[ricochet-webhook] Added contact activity for prospect: ${matchedProspectId}`);
      } catch (err) {
        console.error(`[ricochet-webhook] Contact activity error:`, err);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        call_id: insertedCall.id,
        matched_team_member: !!matchedTeamMemberId,
        matched_prospect: !!matchedProspectId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[ricochet-webhook] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
