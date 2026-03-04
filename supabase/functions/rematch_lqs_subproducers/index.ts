import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-staff-session",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface RematchRequest {
  agency_id: string;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeCode(value: string | null | undefined): string {
  return (value || "").trim().toLowerCase();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const body = (await req.json().catch(() => ({}))) as Partial<RematchRequest>;
    const agencyId = body.agency_id;
    if (!agencyId) return json(400, { error: "agency_id is required" });

    let authorized = false;

    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData } = await userClient.auth.getUser();
      const userId = userData.user?.id;
      if (userId) {
        const { data: access, error: accessError } = await admin.rpc(
          "has_agency_access",
          { _user_id: userId, _agency_id: agencyId },
        );
        if (!accessError && access === true) authorized = true;
      }
    }

    if (!authorized) {
      const sessionToken = req.headers.get("x-staff-session");
      if (sessionToken) {
        const nowIso = new Date().toISOString();
        const { data: session, error: sessionError } = await admin
          .from("staff_sessions")
          .select("staff_user_id, is_valid, expires_at")
          .eq("session_token", sessionToken)
          .eq("is_valid", true)
          .gt("expires_at", nowIso)
          .maybeSingle();

        if (!sessionError && session) {
          const { data: staffUser, error: staffError } = await admin
            .from("staff_users")
            .select("agency_id, is_active")
            .eq("id", session.staff_user_id)
            .maybeSingle();
          if (!staffError && staffUser?.is_active && staffUser.agency_id === agencyId) {
            authorized = true;
          }
        }
      }
    }

    if (!authorized) return json(403, { error: "Unauthorized for requested agency" });

    const { data: teamMembers, error: tmError } = await admin
      .from("team_members")
      .select("id, sub_producer_code")
      .eq("agency_id", agencyId)
      .not("sub_producer_code", "is", null);
    if (tmError) return json(500, { error: tmError.message });

    const codeToTeamMember = new Map<string, string>();
    for (const member of teamMembers || []) {
      const normalized = normalizeCode(member.sub_producer_code);
      if (normalized) codeToTeamMember.set(normalized, member.id);
    }

    if (codeToTeamMember.size === 0) {
      return json(200, {
        success: true,
        matched_lqs_rows: 0,
        updated_sales_rows: 0,
        updated_households: 0,
        notes: "No team members with sub-producer codes found.",
      });
    }

    const { data: candidates, error: candidateError } = await admin
      .from("lqs_sales")
      .select("id, household_id, source_reference_id, raw_subproducer_code, team_member_id")
      .eq("agency_id", agencyId)
      .is("team_member_id", null)
      .not("raw_subproducer_code", "is", null);
    if (candidateError) return json(500, { error: candidateError.message });

    const nowIso = new Date().toISOString();
    let matchedLqsRows = 0;
    let updatedSalesRows = 0;
    const touchedHouseholds = new Set<string>();
    const processedSales = new Set<string>();

    for (const row of candidates || []) {
      const normalized = normalizeCode(row.raw_subproducer_code);
      const matchedTeamMemberId = codeToTeamMember.get(normalized);
      if (!matchedTeamMemberId) continue;

      const { error: updateLqsError } = await admin
        .from("lqs_sales")
        .update({
          team_member_id: matchedTeamMemberId,
          match_status: "rematched",
          rematched_at: nowIso,
        })
        .eq("id", row.id);
      if (updateLqsError) {
        console.error("[rematch_lqs_subproducers] Failed lqs_sales update", updateLqsError);
        continue;
      }
      matchedLqsRows += 1;
      touchedHouseholds.add(row.household_id);

      if (row.source_reference_id && !processedSales.has(row.source_reference_id)) {
        const { data: updatedSales, error: updateSaleError } = await admin
          .from("sales")
          .update({ team_member_id: matchedTeamMemberId })
          .eq("agency_id", agencyId)
          .eq("id", row.source_reference_id)
          .select("id");
        if (!updateSaleError && updatedSales) {
          updatedSalesRows += updatedSales.length;
          processedSales.add(row.source_reference_id);
        }
      }
    }

    let updatedHouseholds = 0;
    for (const householdId of touchedHouseholds) {
      const { data: householdSales } = await admin
        .from("lqs_sales")
        .select("team_member_id, sale_date")
        .eq("agency_id", agencyId)
        .eq("household_id", householdId)
        .not("team_member_id", "is", null)
        .order("sale_date", { ascending: false })
        .limit(1);

      const latestTeamMemberId = householdSales?.[0]?.team_member_id;
      if (!latestTeamMemberId) continue;

      const { data: updatedHousehold, error: householdUpdateError } = await admin
        .from("lqs_households")
        .update({ team_member_id: latestTeamMemberId })
        .eq("id", householdId)
        .eq("agency_id", agencyId)
        .select("id");
      if (!householdUpdateError && updatedHousehold) {
        updatedHouseholds += updatedHousehold.length;
      }
    }

    return json(200, {
      success: true,
      matched_lqs_rows: matchedLqsRows,
      updated_sales_rows: updatedSalesRows,
      updated_households: updatedHouseholds,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return json(500, { error: message });
  }
});
