import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-staff-session",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get session token from header
    const sessionToken = req.headers.get("x-staff-session");
    if (!sessionToken) {
      console.log("[get-staff-commission] No session token provided");
      return new Response(
        JSON.stringify({ error: "No session token provided" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify session
    const { data: session, error: sessionError } = await supabase
      .from("staff_sessions")
      .select("id, staff_user_id, expires_at")
      .eq("session_token", sessionToken)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (sessionError || !session) {
      console.log("[get-staff-commission] Invalid or expired session");
      return new Response(
        JSON.stringify({ error: "Invalid or expired session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get staff user and team member
    const { data: staffUser, error: staffError } = await supabase
      .from("staff_users")
      .select("id, agency_id, team_member_id")
      .eq("id", session.staff_user_id)
      .single();

    if (staffError || !staffUser) {
      console.log("[get-staff-commission] Staff user not found");
      return new Response(
        JSON.stringify({ error: "Staff user not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!staffUser.team_member_id) {
      console.log("[get-staff-commission] Staff not linked to team member");
      return new Response(
        JSON.stringify({ error: "Staff not linked to team member", plan: null }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get request body
    const body = await req.json();
    const { month, year } = body;

    console.log(`[get-staff-commission] Fetching commission for team_member_id=${staffUser.team_member_id}, month=${month}, year=${year}`);

    // Get team member details
    const { data: teamMember, error: tmError } = await supabase
      .from("team_members")
      .select("id, name, sub_producer_code")
      .eq("id", staffUser.team_member_id)
      .single();

    if (tmError || !teamMember) {
      console.log("[get-staff-commission] Team member not found");
      return new Response(
        JSON.stringify({ error: "Team member not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get comp plan assignment
    const { data: assignment, error: assignError } = await supabase
      .from("comp_plan_assignments")
      .select("comp_plan_id")
      .eq("team_member_id", staffUser.team_member_id)
      .is("end_date", null)
      .maybeSingle();

    if (!assignment) {
      console.log("[get-staff-commission] No plan assignment found");
      return new Response(
        JSON.stringify({
          plan: null,
          tiers: [],
          current_payout: null,
          current_month_written_premium: 0,
          team_member_name: teamMember.name,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get comp plan
    const { data: plan, error: planError } = await supabase
      .from("comp_plans")
      .select("id, name, payout_type, tier_metric")
      .eq("id", assignment.comp_plan_id)
      .single();

    if (planError || !plan) {
      console.log("[get-staff-commission] Plan not found");
      return new Response(
        JSON.stringify({ error: "Comp plan not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get tiers
    const { data: tiers, error: tiersError } = await supabase
      .from("comp_plan_tiers")
      .select("min_threshold, commission_value, sort_order")
      .eq("comp_plan_id", plan.id)
      .order("sort_order", { ascending: true });

    if (tiersError) {
      console.error("[get-staff-commission] Error fetching tiers:", tiersError);
    }

    // Get current payout for this period
    const { data: currentPayout, error: payoutError } = await supabase
      .from("comp_payouts")
      .select("written_premium, written_items, written_policies, net_premium, tier_threshold_met, tier_commission_value, total_payout, status")
      .eq("team_member_id", staffUser.team_member_id)
      .eq("period_month", month)
      .eq("period_year", year)
      .maybeSingle();

    if (payoutError) {
      console.error("[get-staff-commission] Error fetching payout:", payoutError);
    }

    // Calculate current month written premium from sales data
    // First, determine date range for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    const startStr = startDate.toISOString().split("T")[0];
    const endStr = endDate.toISOString().split("T")[0];

    // Get sales for the period
    const { data: sales, error: salesError } = await supabase
      .from("sales")
      .select("total_premium")
      .eq("team_member_id", staffUser.team_member_id)
      .gte("sale_date", startStr)
      .lte("sale_date", endStr);

    let currentMonthWrittenPremium = 0;
    if (!salesError && sales) {
      currentMonthWrittenPremium = sales.reduce((sum, s) => sum + (s.total_premium || 0), 0);
    }

    // If we have a payout record, use its written_premium instead (more accurate from statement)
    if (currentPayout?.written_premium) {
      currentMonthWrittenPremium = currentPayout.written_premium;
    }

    console.log(`[get-staff-commission] Success - plan=${plan.name}, premium=${currentMonthWrittenPremium}`);

    return new Response(
      JSON.stringify({
        plan,
        tiers: tiers || [],
        current_payout: currentPayout || null,
        current_month_written_premium: currentMonthWrittenPremium,
        team_member_name: teamMember.name,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[get-staff-commission] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
