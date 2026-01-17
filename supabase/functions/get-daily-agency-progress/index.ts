import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // Default to today if no date provided
    const targetDate = date || new Date().toISOString().split('T')[0];

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

    // Calculate totals
    const totalQuotedHouseholds = metricsData?.reduce((sum, row) => sum + (row.quoted_count || 0), 0) || 0;
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
