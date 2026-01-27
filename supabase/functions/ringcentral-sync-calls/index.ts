import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VoipIntegration {
  id: string;
  agency_id: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
  last_sync_at: string | null;
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
 * Refresh access token if expiring within 5 minutes
 */
async function refreshTokenIfNeeded(
  supabase: SupabaseClient,
  integration: VoipIntegration
): Promise<string | null> {
  const now = new Date();
  const expiresAt = new Date(integration.token_expires_at);
  const fiveMinutes = 5 * 60 * 1000;

  // Token still valid for more than 5 minutes
  if (expiresAt.getTime() - now.getTime() > fiveMinutes) {
    return integration.access_token;
  }

  console.log(`[ringcentral-sync] Refreshing token for agency: ${integration.agency_id}`);

  const clientId = Deno.env.get("RINGCENTRAL_CLIENT_ID");
  const clientSecret = Deno.env.get("RINGCENTRAL_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    console.error("[ringcentral-sync] Missing RingCentral credentials for token refresh");
    return null;
  }

  try {
    const response = await fetch("https://platform.ringcentral.com/restapi/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: integration.refresh_token,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ringcentral-sync] Token refresh failed: ${errorText}`);

      // Mark integration as inactive
      await supabase
        .from("voip_integrations")
        .update({
          is_active: false,
          last_sync_error: "Token refresh failed - reconnection required",
          updated_at: new Date().toISOString(),
        })
        .eq("id", integration.id);

      return null;
    }

    const tokens = await response.json();
    const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Update stored tokens
    await supabase
      .from("voip_integrations")
      .update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: newExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", integration.id);

    console.log(`[ringcentral-sync] Token refreshed for agency: ${integration.agency_id}`);
    return tokens.access_token;

  } catch (error) {
    console.error(`[ringcentral-sync] Token refresh error:`, error);
    return null;
  }
}

/**
 * Sync call logs for a single agency integration
 */
async function syncAgencyCalls(
  supabase: SupabaseClient,
  integration: VoipIntegration
): Promise<number> {
  const accessToken = await refreshTokenIfNeeded(supabase, integration);
  if (!accessToken) {
    return 0;
  }

  // Determine start date: last_sync_at or 24 hours ago
  const since = integration.last_sync_at
    ? new Date(integration.last_sync_at)
    : new Date(Date.now() - 24 * 60 * 60 * 1000);

  console.log(`[ringcentral-sync] Fetching calls for agency ${integration.agency_id} since ${since.toISOString()}`);

  let page = 1;
  let hasMore = true;
  let totalSynced = 0;

  while (hasMore) {
    const callLogUrl = new URL("https://platform.ringcentral.com/restapi/v1.0/account/~/call-log");
    callLogUrl.searchParams.set("dateFrom", since.toISOString());
    callLogUrl.searchParams.set("perPage", "250");
    callLogUrl.searchParams.set("page", page.toString());
    callLogUrl.searchParams.set("view", "Detailed");

    try {
      const response = await fetch(callLogUrl.toString(), {
        headers: { "Authorization": `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[ringcentral-sync] API error for agency ${integration.agency_id}: ${errorText}`);

        await supabase
          .from("voip_integrations")
          .update({
            last_sync_error: `API error: ${response.status}`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", integration.id);

        return totalSynced;
      }

      const data = await response.json();
      const calls = data.records || [];

      // Process each call
      for (const call of calls) {
        const fromNumber = normalizePhone(call.from?.phoneNumber);
        const toNumber = normalizePhone(call.to?.phoneNumber);

        const { error: insertError } = await supabase
          .from("call_events")
          .upsert({
            agency_id: integration.agency_id,
            voip_integration_id: integration.id,
            external_call_id: call.id,
            provider: "ringcentral",
            direction: call.direction,
            call_type: call.type,
            from_number: fromNumber,
            to_number: toNumber,
            call_started_at: call.startTime,
            call_ended_at: call.endTime,
            duration_seconds: call.duration || 0,
            result: call.result,
            extension_id: call.extension?.id,
            extension_name: call.extension?.name,
            raw_payload: call,
          }, {
            onConflict: "provider,external_call_id",
            ignoreDuplicates: true,
          });

        if (!insertError) {
          totalSynced++;
        }
      }

      // Check for more pages
      hasMore = data.paging && data.paging.page < data.paging.totalPages;
      page++;

      // Rate limit safety: 100ms delay between pages
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

    } catch (error) {
      console.error(`[ringcentral-sync] Fetch error for agency ${integration.agency_id}:`, error);
      hasMore = false;
    }
  }

  // Update last_sync_at on success
  await supabase
    .from("voip_integrations")
    .update({
      last_sync_at: new Date().toISOString(),
      last_sync_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", integration.id);

  console.log(`[ringcentral-sync] Synced ${totalSynced} calls for agency: ${integration.agency_id}`);
  return totalSynced;
}

/**
 * Aggregate daily call metrics for an agency
 */
async function aggregateDailyMetrics(
  supabase: SupabaseClient,
  agencyId: string
): Promise<void> {
  const today = new Date().toISOString().split("T")[0];

  // Get today's calls for this agency
  const { data: calls, error } = await supabase
    .from("call_events")
    .select("direction, duration_seconds, result, extension_name, matched_team_member_id")
    .eq("agency_id", agencyId)
    .gte("call_started_at", `${today}T00:00:00Z`)
    .lt("call_started_at", `${today}T23:59:59Z`);

  if (error || !calls?.length) {
    return;
  }

  // Aggregate by team member (or extension if not matched)
  const metrics: Record<string, {
    team_member_id: string | null;
    total_calls: number;
    inbound_calls: number;
    outbound_calls: number;
    answered_calls: number;
    missed_calls: number;
    total_talk_seconds: number;
  }> = {};

  for (const call of calls) {
    const key = call.matched_team_member_id || `ext_${call.extension_name}` || "unknown";

    if (!metrics[key]) {
      metrics[key] = {
        team_member_id: call.matched_team_member_id,
        total_calls: 0,
        inbound_calls: 0,
        outbound_calls: 0,
        answered_calls: 0,
        missed_calls: 0,
        total_talk_seconds: 0,
      };
    }

    metrics[key].total_calls++;

    if (call.direction === "Inbound") {
      metrics[key].inbound_calls++;
    }
    if (call.direction === "Outbound") {
      metrics[key].outbound_calls++;
    }
    if (call.result === "Accepted" || call.result === "Call connected") {
      metrics[key].answered_calls++;
    }
    if (call.result === "Missed") {
      metrics[key].missed_calls++;
    }

    metrics[key].total_talk_seconds += call.duration_seconds || 0;
  }

  // Upsert metrics for team members only (skip extension-only entries)
  for (const [_key, data] of Object.entries(metrics)) {
    if (data.team_member_id) {
      await supabase
        .from("call_metrics_daily")
        .upsert({
          agency_id: agencyId,
          team_member_id: data.team_member_id,
          date: today,
          total_calls: data.total_calls,
          inbound_calls: data.inbound_calls,
          outbound_calls: data.outbound_calls,
          answered_calls: data.answered_calls,
          missed_calls: data.missed_calls,
          total_talk_seconds: data.total_talk_seconds,
          last_calculated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "agency_id,team_member_id,date",
        });
    }
  }

  console.log(`[ringcentral-sync] Aggregated metrics for agency ${agencyId}: ${Object.keys(metrics).length} groups`);
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create service role client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get all active RingCentral integrations
    const { data: integrations, error: fetchError } = await supabaseAdmin
      .from("voip_integrations")
      .select("id, agency_id, access_token, refresh_token, token_expires_at, last_sync_at")
      .eq("provider", "ringcentral")
      .eq("is_active", true);

    if (fetchError) {
      throw fetchError;
    }

    console.log(`[ringcentral-sync] Processing ${integrations?.length || 0} active integrations`);

    let totalProcessed = 0;
    let totalCalls = 0;

    // Process each integration
    for (const integration of integrations || []) {
      try {
        const synced = await syncAgencyCalls(supabaseAdmin, integration as VoipIntegration);
        totalCalls += synced;

        // Aggregate daily metrics after syncing
        await aggregateDailyMetrics(supabaseAdmin, integration.agency_id);

        totalProcessed++;
      } catch (err) {
        console.error(`[ringcentral-sync] Error processing agency ${integration.agency_id}:`, err);
      }
    }

    console.log(`[ringcentral-sync] Complete: ${totalProcessed} agencies, ${totalCalls} calls synced`);

    return new Response(JSON.stringify({
      success: true,
      processed: totalProcessed,
      calls_synced: totalCalls,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[ringcentral-sync] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
