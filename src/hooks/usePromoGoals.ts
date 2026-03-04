import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInDays, isAfter, isBefore, isWithinInterval, parseISO, startOfDay } from "date-fns";
import { calculateCountableTotals, isExcludedProduct } from "@/lib/product-constants";
import { getBusinessDaysInInterval } from "@/utils/businessDays";

export interface PromoGoal {
  id: string;
  agency_id: string;
  goal_name: string;
  description: string | null;
  measurement: string;
  target_value: number;
  bonus_amount_cents: number | null;
  start_date: string;
  end_date: string;
  promo_source: 'sales' | 'metrics';
  product_type_id: string | null;
  kpi_slug: string | null;
  goal_focus: string;
  is_active: boolean;
  count_business_days: boolean;
  product_type?: { name: string } | null;
}

export interface PromoGoalAssignment {
  id: string;
  sales_goal_id: string;
  team_member_id: string;
  team_member?: { name: string } | null;
}

export interface PromoGoalWithProgress extends PromoGoal {
  progress: number;
  assignments: PromoGoalAssignment[];
  daysRemaining: number;
  status: 'upcoming' | 'active' | 'ended';
  isAchieved: boolean;
}

interface PromoSalePolicy {
  product_type_id: string | null;
  policy_type_name: string | null;
  total_premium: number | null;
  total_items: number | null;
  total_points: number | null;
}

// sale_policies.product_type_id references policy_types.id, NOT product_types.id.
// Promo goals store product_types.id. This helper resolves the indirection.
async function resolvePolicyTypeIds(productTypeId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("policy_types")
    .select("id")
    .eq("product_type_id", productTypeId);
  if (error) throw error;
  return new Set((data || []).map(pt => pt.id));
}

interface PromoSaleRow {
  customer_name: string | null;
  sale_policies: PromoSalePolicy[];
}

async function fetchPromoSalesRows(
  agencyId: string,
  startDate: string,
  endDate: string,
  teamMemberId?: string
): Promise<PromoSaleRow[]> {
  let query = supabase
    .from("sales")
    .select("customer_name, sale_policies(product_type_id, policy_type_name, total_premium, total_items, total_points)")
    .eq("agency_id", agencyId)
    .gte("sale_date", startDate)
    .lte("sale_date", endDate);

  if (teamMemberId) {
    query = query.eq("team_member_id", teamMemberId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as unknown as PromoSaleRow[];
}

// Fetch all promo goals for an agency (admin view)
export function usePromoGoals(agencyId: string | null) {
  return useQuery({
    queryKey: ["promo-goals", agencyId],
    queryFn: async () => {
      if (!agencyId) return [];

      const { data: goals, error } = await supabase
        .from("sales_goals")
        .select(`
          *,
          product_type:product_types(name)
        `)
        .eq("agency_id", agencyId)
        .eq("goal_type", "promo")
        .eq("is_active", true)
        .order("start_date", { ascending: true });

      if (error) throw error;
      
      // Fetch assignments for each goal
      const goalIds = goals?.map(g => g.id) || [];
      
      if (goalIds.length === 0) return [];
      
      const { data: assignments, error: assignError } = await supabase
        .from("sales_goal_assignments")
        .select(`
          *,
          team_member:team_members(name)
        `)
        .in("sales_goal_id", goalIds);
      
      if (assignError) throw assignError;
      
      // Group assignments by goal
      const assignmentsByGoal: Record<string, PromoGoalAssignment[]> = {};
      for (const a of assignments || []) {
        if (!assignmentsByGoal[a.sales_goal_id]) {
          assignmentsByGoal[a.sales_goal_id] = [];
        }
        assignmentsByGoal[a.sales_goal_id].push(a);
      }
      
      const today = startOfDay(new Date());
      
      return goals?.map(goal => {
        const startDate = parseISO(goal.start_date);
        const endDate = parseISO(goal.end_date);

        let status: 'upcoming' | 'active' | 'ended' = 'active';
        if (isBefore(today, startDate)) {
          status = 'upcoming';
        } else if (isAfter(today, endDate)) {
          status = 'ended';
        }

        const useBusinessDays = goal.count_business_days;
        const daysRemaining = status === 'active'
          ? useBusinessDays
            ? getBusinessDaysInInterval(today, endDate)
            : Math.max(0, differenceInDays(endDate, today) + 1)
          : status === 'upcoming'
            ? useBusinessDays
              ? getBusinessDaysInInterval(today, startDate)
              : differenceInDays(startDate, today)
            : 0;

        return {
          ...goal,
          assignments: assignmentsByGoal[goal.id] || [],
          daysRemaining,
          status,
          progress: 0, // Will be calculated separately per team member
          isAchieved: false,
        } as PromoGoalWithProgress;
      }) || [];
    },
    enabled: !!agencyId,
  });
}

// Fetch promo goals assigned to a specific team member
export function useTeamMemberPromoGoals(agencyId: string | null, teamMemberId: string | null) {
  return useQuery({
    queryKey: ["promo-goals-member", agencyId, teamMemberId],
    queryFn: async () => {
      if (!agencyId || !teamMemberId) return [];

      // Get assignments for this team member
      const { data: assignments, error: assignError } = await supabase
        .from("sales_goal_assignments")
        .select("sales_goal_id")
        .eq("team_member_id", teamMemberId);

      if (assignError) throw assignError;
      
      const goalIds = assignments?.map(a => a.sales_goal_id) || [];
      
      if (goalIds.length === 0) return [];
      
      const { data: goals, error } = await supabase
        .from("sales_goals")
        .select(`
          *,
          product_type:product_types(name)
        `)
        .in("id", goalIds)
        .eq("goal_type", "promo")
        .eq("is_active", true);

      if (error) throw error;
      
      const today = startOfDay(new Date());
      
      return goals?.map(goal => {
        const startDate = parseISO(goal.start_date);
        const endDate = parseISO(goal.end_date);

        let status: 'upcoming' | 'active' | 'ended' = 'active';
        if (isBefore(today, startDate)) {
          status = 'upcoming';
        } else if (isAfter(today, endDate)) {
          status = 'ended';
        }

        const useBusinessDays = goal.count_business_days;
        const daysRemaining = status === 'active'
          ? useBusinessDays
            ? getBusinessDaysInInterval(today, endDate)
            : Math.max(0, differenceInDays(endDate, today) + 1)
          : status === 'upcoming'
            ? useBusinessDays
              ? getBusinessDaysInInterval(today, startDate)
              : differenceInDays(startDate, today)
            : 0;

        return {
          ...goal,
          assignments: [],
          daysRemaining,
          status,
          progress: 0,
          isAchieved: false,
        } as PromoGoalWithProgress;
      }) || [];
    },
    enabled: !!agencyId && !!teamMemberId,
  });
}

// Calculate progress for a single promo goal for a team member
export async function calculatePromoProgress(
  goal: PromoGoal,
  teamMemberId: string,
  agencyId: string
): Promise<number> {
  const startDate = goal.start_date;
  const endDate = goal.end_date;
  
  if (goal.promo_source === 'sales') {
    return calculateSalesProgress(goal, teamMemberId, agencyId, startDate, endDate);
  } else {
    return calculateMetricsProgress(goal, teamMemberId, agencyId, startDate, endDate);
  }
}

// Calculate progress for an agency-wide promo goal (all team members combined)
export async function calculateAgencyWidePromoProgress(
  goal: PromoGoal,
  agencyId: string
): Promise<number> {
  const startDate = goal.start_date;
  const endDate = goal.end_date;
  
  if (goal.promo_source === 'sales') {
    return calculateAgencyWideSalesProgress(goal, agencyId, startDate, endDate);
  } else {
    return calculateAgencyWideMetricsProgress(goal, agencyId, startDate, endDate);
  }
}

async function calculateSalesProgress(
  goal: PromoGoal,
  teamMemberId: string,
  agencyId: string,
  startDate: string,
  endDate: string
): Promise<number> {
  const measurement = goal.measurement;
  const productTypeId = goal.product_type_id;
  const sales = await fetchPromoSalesRows(agencyId, startDate, endDate, teamMemberId);

  // Resolve product_types.id → set of policy_types.id for filtering
  const policyTypeIds = productTypeId ? await resolvePolicyTypeIds(productTypeId) : null;

  const households = new Set<string>();
  let premium = 0;
  let items = 0;
  let points = 0;
  let policies = 0;

  for (const sale of sales) {
    const basePolicies = (sale.sale_policies || []).filter((p) => !isExcludedProduct(p.policy_type_name));
    const scopedPolicies = policyTypeIds
      ? basePolicies.filter((p) => p.product_type_id != null && policyTypeIds.has(p.product_type_id))
      : basePolicies;

    const countable = calculateCountableTotals(scopedPolicies);
    premium += countable.premium;
    items += countable.items;
    points += countable.points;
    policies += countable.policyCount;

    if (countable.policyCount > 0) {
      const customer = sale.customer_name?.toLowerCase().trim();
      if (customer) households.add(customer);
    }
  }

  if (measurement === 'premium') return premium;
  if (measurement === 'items') return items;
  if (measurement === 'points') return points;
  if (measurement === 'policies') return policies;
  if (measurement === 'households') return households.size;
  
  return 0;
}

async function calculateMetricsProgress(
  goal: PromoGoal,
  teamMemberId: string,
  agencyId: string,
  startDate: string,
  endDate: string
): Promise<number> {
  const kpiSlug = goal.kpi_slug;
  if (!kpiSlug) return 0;
  
  // Map kpi_slug to metrics_daily column
  const columnMap: Record<string, string> = {
    'outbound_calls': 'outbound_calls',
    'talk_minutes': 'talk_minutes',
    'quoted_count': 'quoted_count',
    'quoted_households': 'quoted_count',
    'sold_items': 'sold_items',
    'items_sold': 'sold_items',
    'sold_policies': 'sold_policies',
    'cross_sells_uncovered': 'cross_sells_uncovered',
    'mini_reviews': 'mini_reviews',
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
  
  return (
    data?.reduce((sum, row) => {
      const metricRow = row as Record<string, number | null>;
      return sum + (metricRow[column] || 0);
    }, 0) || 0
  );
}

// Agency-wide sales progress calculation (no team_member filter)
async function calculateAgencyWideSalesProgress(
  goal: PromoGoal,
  agencyId: string,
  startDate: string,
  endDate: string
): Promise<number> {
  const measurement = goal.measurement;
  const productTypeId = goal.product_type_id;
  const sales = await fetchPromoSalesRows(agencyId, startDate, endDate);

  // Resolve product_types.id → set of policy_types.id for filtering
  const policyTypeIds = productTypeId ? await resolvePolicyTypeIds(productTypeId) : null;

  const households = new Set<string>();
  let premium = 0;
  let items = 0;
  let points = 0;
  let policies = 0;

  for (const sale of sales) {
    const basePolicies = (sale.sale_policies || []).filter((p) => !isExcludedProduct(p.policy_type_name));
    const scopedPolicies = policyTypeIds
      ? basePolicies.filter((p) => p.product_type_id != null && policyTypeIds.has(p.product_type_id))
      : basePolicies;

    const countable = calculateCountableTotals(scopedPolicies);
    premium += countable.premium;
    items += countable.items;
    points += countable.points;
    policies += countable.policyCount;

    if (countable.policyCount > 0) {
      const customer = sale.customer_name?.toLowerCase().trim();
      if (customer) households.add(customer);
    }
  }

  if (measurement === 'premium') return premium;
  if (measurement === 'items') return items;
  if (measurement === 'points') return points;
  if (measurement === 'policies') return policies;
  if (measurement === 'households') return households.size;
  
  return 0;
}

// Agency-wide metrics progress calculation (sum across all team members)
async function calculateAgencyWideMetricsProgress(
  goal: PromoGoal,
  agencyId: string,
  startDate: string,
  endDate: string
): Promise<number> {
  const kpiSlug = goal.kpi_slug;
  if (!kpiSlug) return 0;
  
  const columnMap: Record<string, string> = {
    'outbound_calls': 'outbound_calls',
    'talk_minutes': 'talk_minutes',
    'quoted_count': 'quoted_count',
    'quoted_households': 'quoted_count',
    'sold_items': 'sold_items',
    'items_sold': 'sold_items',
    'sold_policies': 'sold_policies',
    'cross_sells_uncovered': 'cross_sells_uncovered',
    'mini_reviews': 'mini_reviews',
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
  
  return (
    data?.reduce((sum, row) => {
      const metricRow = row as Record<string, number | null>;
      return sum + (metricRow[column] || 0);
    }, 0) || 0
  );
}

// Hook to get progress for promo goals for a specific team member
export function usePromoGoalProgress(
  goals: PromoGoalWithProgress[],
  teamMemberId: string | null,
  agencyId: string | null
) {
  return useQuery({
    queryKey: ["promo-goal-progress", goals.map(g => g.id).join(","), teamMemberId],
    queryFn: async () => {
      if (!teamMemberId || !agencyId || goals.length === 0) return [];
      
      const results: PromoGoalWithProgress[] = [];
      
      for (const goal of goals) {
        try {
          const progress = await calculatePromoProgress(goal, teamMemberId, agencyId);
          results.push({
            ...goal,
            progress,
            isAchieved: progress >= goal.target_value,
          });
        } catch (e) {
          console.error("Error calculating promo progress:", e);
          results.push({ ...goal, progress: 0, isAchieved: false });
        }
      }
      
      return results;
    },
    enabled: !!teamMemberId && !!agencyId && goals.length > 0,
  });
}
