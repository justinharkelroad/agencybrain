import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { verifyRequest, isVerifyError } from "../_shared/verifyRequest.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-staff-session, x-staff-session-token",
};

function bad(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function ok(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const verified = await verifyRequest(req);
  if (isVerifyError(verified)) {
    return bad(verified.error, verified.status);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceRoleKey);

  try {
    const body = await req.json().catch(() => ({}));
    let teamMemberId: string | null = body?.team_member_id ?? null;
    const startDate: string | null = body?.start_date ?? null;
    const endDate: string | null = body?.end_date ?? null;
    const todayDate: string | null = body?.today_date ?? null;

    if (!startDate || !endDate || !todayDate) {
      return bad("start_date, end_date, and today_date are required");
    }

    // Validate date formats (YYYY-MM-DD)
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (
      !datePattern.test(startDate) ||
      !datePattern.test(endDate) ||
      !datePattern.test(todayDate)
    ) {
      return bad("Dates must be in YYYY-MM-DD format");
    }

    const agencyId = verified.agencyId;

    // Non-manager staff: restrict to own team_member_id only
    if (verified.mode === "staff" && !verified.isManager) {
      if (teamMemberId !== null && teamMemberId !== verified.staffMemberId) {
        return bad("You can only view your own metrics", 403);
      }
      // When null is passed, default to their own member — never expose team aggregate
      if (teamMemberId === null) {
        if (!verified.staffMemberId) {
          // Staff with no linked team member has no metrics
          return ok({
            period_quoted_count: 0,
            today_quoted_count: 0,
            period_sold_items: 0,
            today_sold_items: 0,
            days_with_data: 0,
          });
        }
        teamMemberId = verified.staffMemberId;
      }
    }

    // Period totals — raise limit above PostgREST default (1000) to avoid
    // silent truncation for large teams over long date ranges.
    let periodQuery = sb
      .from("metrics_daily")
      .select("quoted_count, sold_items")
      .eq("agency_id", agencyId)
      .gte("date", startDate)
      .lte("date", endDate)
      .limit(10000);

    if (teamMemberId) {
      periodQuery = periodQuery.eq("team_member_id", teamMemberId);
    }

    const { data: periodRows, error: periodError } = await periodQuery;

    if (periodError) {
      console.error("[get-household-focus-actuals] period query error", periodError);
      return bad("Failed to query period metrics", 500);
    }

    let periodQuotedCount = 0;
    let periodSoldItems = 0;
    let daysWithData = 0;
    for (const row of periodRows || []) {
      const qc = Number(row.quoted_count) || 0;
      const si = Number(row.sold_items) || 0;
      periodQuotedCount += qc;
      periodSoldItems += si;
      if (qc > 0 || si > 0) daysWithData++;
    }

    // Today totals
    let todayQuery = sb
      .from("metrics_daily")
      .select("quoted_count, sold_items")
      .eq("agency_id", agencyId)
      .eq("date", todayDate);

    if (teamMemberId) {
      todayQuery = todayQuery.eq("team_member_id", teamMemberId);
    }

    const { data: todayRows, error: todayError } = await todayQuery;

    if (todayError) {
      console.error("[get-household-focus-actuals] today query error", todayError);
      return bad("Failed to query today metrics", 500);
    }

    let todayQuotedCount = 0;
    let todaySoldItems = 0;
    for (const row of todayRows || []) {
      todayQuotedCount += Number(row.quoted_count) || 0;
      todaySoldItems += Number(row.sold_items) || 0;
    }

    return ok({
      period_quoted_count: periodQuotedCount,
      today_quoted_count: todayQuotedCount,
      period_sold_items: periodSoldItems,
      today_sold_items: todaySoldItems,
      days_with_data: daysWithData,
    });
  } catch (error) {
    console.error("[get-household-focus-actuals] unexpected error", error);
    return bad(
      error instanceof Error ? error.message : "Unexpected error",
      500
    );
  }
});
