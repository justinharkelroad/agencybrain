import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-staff-session",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate staff session
    const sessionToken = req.headers.get("x-staff-session");
    if (!sessionToken) {
      return new Response(
        JSON.stringify({ error: "Missing staff session token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate session - staff_sessions uses is_valid column
    const { data: session, error: sessionError } = await supabase
      .from("staff_sessions")
      .select("staff_user_id, is_valid")
      .eq("session_token", sessionToken)
      .single();

    if (sessionError || !session || !session.is_valid) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get staff user info
    const { data: staffUser, error: staffError } = await supabase
      .from("staff_users")
      .select("agency_id, team_member_id")
      .eq("id", session.staff_user_id)
      .single();

    if (staffError || !staffUser) {
      return new Response(
        JSON.stringify({ error: "Staff user not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { agency_id, team_member_id } = staffUser;

    if (!team_member_id) {
      return new Response(
        JSON.stringify({ promos: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get promo goal assignments for this team member
    const { data: assignments, error: assignError } = await supabase
      .from("sales_goal_assignments")
      .select("sales_goal_id")
      .eq("team_member_id", team_member_id);

    if (assignError) throw assignError;

    const assignedGoalIds = assignments?.map(a => a.sales_goal_id) || [];

    // Fetch agency-wide promo goals (no assignments = agency-wide)
    const { data: allPromoGoals, error: allPromoError } = await supabase
      .from("sales_goals")
      .select(`
        id,
        goal_name,
        description,
        measurement,
        target_value,
        bonus_amount_cents,
        start_date,
        end_date,
        promo_source,
        product_type_id,
        kpi_slug,
        goal_focus,
        product_type:product_types(name),
        sales_goal_assignments(id)
      `)
      .eq("agency_id", agency_id)
      .eq("goal_type", "promo")
      .eq("is_active", true);

    if (allPromoError) throw allPromoError;

    // Filter to include: assigned goals OR agency-wide goals (no assignments)
    const goals = (allPromoGoals || []).filter(goal => {
      const isAgencyWide = !goal.sales_goal_assignments || goal.sales_goal_assignments.length === 0;
      const isAssignedToMember = assignedGoalIds.includes(goal.id);
      return isAgencyWide || isAssignedToMember;
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Calculate progress for each goal
    const promosWithProgress = await Promise.all(
      (goals || []).map(async (goal) => {
        const startDate = new Date(goal.start_date);
        const endDate = new Date(goal.end_date);
        const isAgencyWide = !goal.sales_goal_assignments || goal.sales_goal_assignments.length === 0;

        let status: "upcoming" | "active" | "ended" = "active";
        if (today < startDate) {
          status = "upcoming";
        } else if (today > endDate) {
          status = "ended";
        }

        const daysRemaining =
          status === "active"
            ? Math.max(0, Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) + 1)
            : status === "upcoming"
            ? Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
            : 0;

        // Calculate progress based on source and scope
        let progress = 0;

        if (goal.promo_source === "sales") {
          if (isAgencyWide) {
            // Agency-wide: sum across all team members
            progress = await calculateAgencyWideSalesProgress(
              supabase,
              goal,
              agency_id,
              goal.start_date,
              goal.end_date
            );
          } else {
            // Individual: only this team member's progress
            progress = await calculateSalesProgress(
              supabase,
              goal,
              team_member_id,
              agency_id,
              goal.start_date,
              goal.end_date
            );
          }
        } else if (goal.promo_source === "metrics") {
          if (isAgencyWide) {
            progress = await calculateAgencyWideMetricsProgress(
              supabase,
              goal,
              agency_id,
              goal.start_date,
              goal.end_date
            );
          } else {
            progress = await calculateMetricsProgress(
              supabase,
              goal,
              team_member_id,
              agency_id,
              goal.start_date,
              goal.end_date
            );
          }
        }

        return {
          ...goal,
          progress,
          status,
          daysRemaining,
          isAchieved: progress >= goal.target_value,
          isAgencyWide,
        };
      })
    );

    // Filter to show active and upcoming only
    const relevantPromos = promosWithProgress.filter(
      (p) => p.status === "active" || p.status === "upcoming"
    );

    return new Response(
      JSON.stringify({ promos: relevantPromos }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("get_staff_promo_goals error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// sale_policies.product_type_id references policy_types.id, NOT product_types.id.
// Promo goals store product_types.id. This helper resolves the indirection.
async function resolvePolicyTypeIds(
  supabase: any,
  productTypeId: string
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("policy_types")
    .select("id")
    .eq("product_type_id", productTypeId);
  if (error) throw error;
  return new Set((data || []).map((pt: any) => pt.id));
}

async function calculateSalesProgress(
  supabase: any,
  goal: any,
  teamMemberId: string,
  agencyId: string,
  startDate: string,
  endDate: string
): Promise<number> {
  const measurement = goal.measurement;
  const productTypeId = goal.product_type_id;

  // Resolve product_types.id → set of policy_types.id for filtering
  const policyTypeIds = productTypeId
    ? await resolvePolicyTypeIds(supabase, productTypeId)
    : null;

  // Use sale_policies join for product-type-filtered queries
  const { data: salesRows, error: salesError } = await supabase
    .from("sales")
    .select("customer_name, sale_policies(product_type_id, policy_type_name, total_premium, total_items, total_points)")
    .eq("team_member_id", teamMemberId)
    .eq("agency_id", agencyId)
    .gte("sale_date", startDate)
    .lte("sale_date", endDate);

  if (salesError) throw salesError;

  const households = new Set<string>();
  let premium = 0;
  let items = 0;
  let points = 0;
  let policies = 0;

  for (const sale of salesRows || []) {
    const allPolicies = (sale.sale_policies || []) as any[];
    const scopedPolicies = policyTypeIds
      ? allPolicies.filter((p: any) => p.product_type_id != null && policyTypeIds.has(p.product_type_id))
      : allPolicies;

    for (const p of scopedPolicies) {
      premium += p.total_premium || 0;
      items += p.total_items || 0;
      points += p.total_points || 0;
      policies += 1;
    }

    if (scopedPolicies.length > 0) {
      const customer = sale.customer_name?.toLowerCase().trim();
      if (customer) households.add(customer);
    }
  }

  if (measurement === "premium") return premium;
  if (measurement === "items") return items;
  if (measurement === "points") return points;
  if (measurement === "policies") return policies;
  if (measurement === "households") return households.size;

  return 0;
}

async function calculateMetricsProgress(
  supabase: any,
  goal: any,
  teamMemberId: string,
  agencyId: string,
  startDate: string,
  endDate: string
): Promise<number> {
  const kpiSlug = goal.kpi_slug;
  if (!kpiSlug) return 0;

  const columnMap: Record<string, string> = {
    outbound_calls: "outbound_calls",
    talk_minutes: "talk_minutes",
    quoted_count: "quoted_count",
    quoted_households: "quoted_count",
    sold_items: "sold_items",
    items_sold: "sold_items",
    sold_policies: "sold_policies",
    cross_sells_uncovered: "cross_sells_uncovered",
    mini_reviews: "mini_reviews",
  };

  const column = columnMap[kpiSlug];
  if (!column) return 0;

  const { data, error } = await supabase
    .from("metrics_daily")
    .select(column)
    .eq("team_member_id", teamMemberId)
    .eq("agency_id", agencyId)
    .gte("date", startDate)
    .lte("date", endDate);

  if (error) throw error;

  return data?.reduce((sum: number, row: any) => sum + (row[column] || 0), 0) || 0;
}

// Agency-wide calculation functions (no team_member filter)
async function calculateAgencyWideSalesProgress(
  supabase: any,
  goal: any,
  agencyId: string,
  startDate: string,
  endDate: string
): Promise<number> {
  const measurement = goal.measurement;
  const productTypeId = goal.product_type_id;

  // Resolve product_types.id → set of policy_types.id for filtering
  const policyTypeIds = productTypeId
    ? await resolvePolicyTypeIds(supabase, productTypeId)
    : null;

  const { data: salesRows, error: salesError } = await supabase
    .from("sales")
    .select("customer_name, sale_policies(product_type_id, policy_type_name, total_premium, total_items, total_points)")
    .eq("agency_id", agencyId)
    .gte("sale_date", startDate)
    .lte("sale_date", endDate);

  if (salesError) throw salesError;

  const households = new Set<string>();
  let premium = 0;
  let items = 0;
  let points = 0;
  let policies = 0;

  for (const sale of salesRows || []) {
    const allPolicies = (sale.sale_policies || []) as any[];
    const scopedPolicies = policyTypeIds
      ? allPolicies.filter((p: any) => p.product_type_id != null && policyTypeIds.has(p.product_type_id))
      : allPolicies;

    for (const p of scopedPolicies) {
      premium += p.total_premium || 0;
      items += p.total_items || 0;
      points += p.total_points || 0;
      policies += 1;
    }

    if (scopedPolicies.length > 0) {
      const customer = sale.customer_name?.toLowerCase().trim();
      if (customer) households.add(customer);
    }
  }

  if (measurement === "premium") return premium;
  if (measurement === "items") return items;
  if (measurement === "points") return points;
  if (measurement === "policies") return policies;
  if (measurement === "households") return households.size;

  return 0;
}

async function calculateAgencyWideMetricsProgress(
  supabase: any,
  goal: any,
  agencyId: string,
  startDate: string,
  endDate: string
): Promise<number> {
  const kpiSlug = goal.kpi_slug;
  if (!kpiSlug) return 0;

  const columnMap: Record<string, string> = {
    outbound_calls: "outbound_calls",
    talk_minutes: "talk_minutes",
    quoted_count: "quoted_count",
    quoted_households: "quoted_count",
    sold_items: "sold_items",
    items_sold: "sold_items",
    sold_policies: "sold_policies",
    cross_sells_uncovered: "cross_sells_uncovered",
    mini_reviews: "mini_reviews",
  };

  const column = columnMap[kpiSlug];
  if (!column) return 0;

  const { data, error } = await supabase
    .from("metrics_daily")
    .select(column)
    .eq("agency_id", agencyId)
    .gte("date", startDate)
    .lte("date", endDate);

  if (error) throw error;

  return data?.reduce((sum: number, row: any) => sum + (row[column] || 0), 0) || 0;
}
