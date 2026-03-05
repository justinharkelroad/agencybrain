import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { agencyId, date } = await req.json();
    
    if (!agencyId) {
      return new Response(JSON.stringify({ error: "agencyId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Default to today (agency timezone) if no date provided
    let targetDate = date;
    if (!targetDate) {
      const { data: agencyTzRow } = await supabaseAdmin
        .from("agencies")
        .select("timezone")
        .eq("id", agencyId)
        .single();
      targetDate = new Intl.DateTimeFormat("en-CA", { timeZone: agencyTzRow?.timezone || "America/New_York" }).format(new Date());
    }

    console.log(`Fetching daily progress for agency ${agencyId} on ${targetDate}`);

    // Get agency targets
    const { data: agency, error: agencyError } = await supabaseAdmin
      .from("agencies")
      .select("daily_quoted_households_target, daily_sold_items_target")
      .eq("id", agencyId)
      .single();

    if (agencyError) {
      console.error("Error fetching agency:", agencyError);
    }

    // Get sum of quoted households and sold items from metrics_daily for the date
    const { data: metricsData, error: metricsError } = await supabaseAdmin
      .from("metrics_daily")
      .select("quoted_count, sold_items")
      .eq("agency_id", agencyId)
      .eq("date", targetDate);

    if (metricsError) {
      console.error("Error fetching metrics:", metricsError);
    }

    // Also query lqs_households directly as source of truth for quoted count.
    // The metrics_daily trigger can silently skip (e.g. when team_member_id is NULL),
    // so we take the MAX of both sources — same pattern as get-household-focus-actuals.
    const { count: lqsQuotedCount, error: lqsError } = await supabaseAdmin
      .from("lqs_households")
      .select("id", { count: "exact", head: true })
      .eq("agency_id", agencyId)
      .in("status", ["quoted", "sold"])
      .eq("first_quote_date", targetDate);

    if (lqsError) {
      console.error("Error fetching lqs quoted count:", lqsError);
    }

    // Calculate totals — use MAX of metrics_daily vs lqs_households for quoted
    const metricsQuoted = metricsData?.reduce((sum, row) => sum + (row.quoted_count || 0), 0) || 0;
    const lqsQuoted = lqsQuotedCount || 0;
    const totalQuotedHouseholds = Math.max(metricsQuoted, lqsQuoted);
    const totalSoldItems = metricsData?.reduce((sum, row) => sum + (row.sold_items || 0), 0) || 0;

    console.log(`Results: ${totalQuotedHouseholds} quoted, ${totalSoldItems} sold`);

    return new Response(JSON.stringify({
      date: targetDate,
      quotedHouseholds: {
        current: totalQuotedHouseholds,
        target: agency?.daily_quoted_households_target || 15,
      },
      soldItems: {
        current: totalSoldItems,
        target: agency?.daily_sold_items_target || 8,
      },
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
