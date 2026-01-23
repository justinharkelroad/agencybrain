import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-staff-session",
};

interface Tier {
  min_threshold: number;
  commission_value: number;
  sort_order: number;
}

interface TierProgress {
  current_tier: {
    name: string;
    rate: number;
    min_threshold: number;
    tier_index: number;
  } | null;
  next_tier: {
    name: string;
    rate: number;
    min_threshold: number;
    amount_needed: number;
    bonus_if_hit: number;
  } | null;
  current_value: number;
  tier_metric: string;
  progress_percent: number;
  total_tiers: number;
}

// Calculate tier progression
function calculateTierProgress(
  tiers: Tier[],
  currentValue: number,
  tierMetric: string,
  payoutType: string
): TierProgress {
  if (!tiers || tiers.length === 0) {
    return {
      current_tier: null,
      next_tier: null,
      current_value: currentValue,
      tier_metric: tierMetric,
      progress_percent: 0,
      total_tiers: 0,
    };
  }

  // Sort tiers by threshold ascending
  const sortedTiers = [...tiers].sort((a, b) => a.min_threshold - b.min_threshold);

  // Find current tier (highest threshold that's been met)
  let currentTierIndex = -1;
  for (let i = sortedTiers.length - 1; i >= 0; i--) {
    if (currentValue >= sortedTiers[i].min_threshold) {
      currentTierIndex = i;
      break;
    }
  }

  const currentTier = currentTierIndex >= 0 ? sortedTiers[currentTierIndex] : null;
  const nextTier = currentTierIndex < sortedTiers.length - 1
    ? sortedTiers[currentTierIndex + 1]
    : null;

  // Calculate progress toward next tier
  let progressPercent = 0;
  let amountNeeded = 0;
  let bonusIfHit = 0;

  if (nextTier) {
    amountNeeded = nextTier.min_threshold - currentValue;
    const rangeStart = currentTier?.min_threshold || 0;
    const rangeSize = nextTier.min_threshold - rangeStart;
    const progressInRange = currentValue - rangeStart;
    progressPercent = rangeSize > 0 ? Math.round((progressInRange / rangeSize) * 100) : 0;

    // Calculate bonus if they hit next tier
    // For percentage-based: calculate the extra $ they'd earn on all items at higher rate
    if (currentTier && payoutType === 'percentage') {
      const rateDiff = nextTier.commission_value - currentTier.commission_value;
      // Assuming premium-based, calculate approximate bonus
      bonusIfHit = Math.round((rateDiff / 100) * currentValue);
    } else if (currentTier && payoutType === 'flat_per_item') {
      const rateDiff = nextTier.commission_value - currentTier.commission_value;
      bonusIfHit = Math.round(rateDiff * nextTier.min_threshold);
    }
  } else if (currentTier) {
    // At highest tier
    progressPercent = 100;
  }

  return {
    current_tier: currentTier ? {
      name: `Tier ${currentTierIndex + 1}`,
      rate: currentTier.commission_value,
      min_threshold: currentTier.min_threshold,
      tier_index: currentTierIndex,
    } : null,
    next_tier: nextTier ? {
      name: `Tier ${currentTierIndex + 2}`,
      rate: nextTier.commission_value,
      min_threshold: nextTier.min_threshold,
      amount_needed: Math.max(0, amountNeeded),
      bonus_if_hit: bonusIfHit,
    } : null,
    current_value: currentValue,
    tier_metric: tierMetric,
    progress_percent: Math.min(100, Math.max(0, progressPercent)),
    total_tiers: sortedTiers.length,
  };
}

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

    // Get comp plan with brokered settings
    const { data: plan, error: planError } = await supabase
      .from("comp_plans")
      .select("id, name, payout_type, tier_metric, brokered_payout_type, brokered_counts_toward_tier, brokered_flat_rate")
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

    // Get brokered tiers
    const { data: brokeredTiers, error: brokeredTiersError } = await supabase
      .from("comp_plan_brokered_tiers")
      .select("min_threshold, commission_value, sort_order")
      .eq("comp_plan_id", plan.id)
      .order("sort_order", { ascending: true });

    if (brokeredTiersError) {
      console.error("[get-staff-commission] Error fetching brokered tiers:", brokeredTiersError);
    }

    // Get current payout for this period
    const { data: currentPayout, error: payoutError } = await supabase
      .from("comp_payouts")
      .select("written_premium, written_items, written_policies, written_households, net_premium, tier_threshold_met, tier_commission_value, total_payout, status")
      .eq("team_member_id", staffUser.team_member_id)
      .eq("period_month", month)
      .eq("period_year", year)
      .maybeSingle();

    if (payoutError) {
      console.error("[get-staff-commission] Error fetching payout:", payoutError);
    }

    // Calculate current month written premium from sales data
    // Build date strings directly to avoid timezone issues
    const startStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const endStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;
    
    console.log(`[get-staff-commission] Date range: ${startStr} to ${endStr}`);

    // Get sales for the period with all relevant metrics
    const { data: sales, error: salesError } = await supabase
      .from("sales")
      .select("total_premium, total_items")
      .eq("team_member_id", staffUser.team_member_id)
      .gte("sale_date", startStr)
      .lte("sale_date", endStr);

    if (salesError) {
      console.error("[get-staff-commission] Sales query error:", salesError);
    }

    let currentMonthWrittenPremium = 0;
    let currentMonthWrittenItems = 0;
    let currentMonthWrittenPolicies = 0;
    let currentMonthWrittenHouseholds = 0;

    if (!salesError && sales) {
      currentMonthWrittenPremium = sales.reduce((sum, s) => sum + (s.total_premium || 0), 0);
      currentMonthWrittenItems = sales.reduce((sum, s) => sum + (s.total_items || 0), 0);
      currentMonthWrittenPolicies = sales.length;
      // Households not currently trackable without customer_id column
      currentMonthWrittenHouseholds = 0;
    }

    // If we have a payout record, use its values instead (more accurate from statement)
    if (currentPayout?.written_premium) {
      currentMonthWrittenPremium = currentPayout.written_premium;
    }
    if (currentPayout?.written_items) {
      currentMonthWrittenItems = currentPayout.written_items;
    }
    if (currentPayout?.written_policies) {
      currentMonthWrittenPolicies = currentPayout.written_policies;
    }
    if (currentPayout?.written_households) {
      currentMonthWrittenHouseholds = currentPayout.written_households;
    }

    console.log(`[get-staff-commission] Success - plan=${plan.name}, premium=${currentMonthWrittenPremium}, items=${currentMonthWrittenItems}, policies=${currentMonthWrittenPolicies}, households=${currentMonthWrittenHouseholds}`);

    // Calculate tier progress based on the plan's tier_metric
    const tierMetric = plan.tier_metric || 'items';
    let currentValueForTier = currentMonthWrittenItems;

    if (tierMetric === 'premium') {
      currentValueForTier = currentMonthWrittenPremium;
    } else if (tierMetric === 'policies') {
      currentValueForTier = currentMonthWrittenPolicies;
    } else if (tierMetric === 'households') {
      currentValueForTier = currentMonthWrittenHouseholds;
    }

    const tierProgress = calculateTierProgress(
      (tiers || []) as Tier[],
      currentValueForTier,
      tierMetric,
      plan.payout_type || 'flat_per_item'
    );

    console.log(`[get-staff-commission] Tier progress:`, JSON.stringify(tierProgress));

    return new Response(
      JSON.stringify({
        plan,
        tiers: tiers || [],
        brokered_tiers: brokeredTiers || [],
        current_payout: currentPayout || null,
        current_month_written_premium: currentMonthWrittenPremium,
        current_month_written_items: currentMonthWrittenItems,
        current_month_written_policies: currentMonthWrittenPolicies,
        current_month_written_households: currentMonthWrittenHouseholds,
        team_member_name: teamMember.name,
        // NEW: Tier progression data
        tier_progress: tierProgress,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[get-staff-commission] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
