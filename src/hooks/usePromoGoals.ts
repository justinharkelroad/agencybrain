import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInDays, isAfter, isBefore, isWithinInterval, parseISO, startOfDay } from "date-fns";

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
        
        const daysRemaining = status === 'active' 
          ? Math.max(0, differenceInDays(endDate, today) + 1)
          : status === 'upcoming'
            ? differenceInDays(startDate, today)
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
        
        const daysRemaining = status === 'active' 
          ? Math.max(0, differenceInDays(endDate, today) + 1)
          : status === 'upcoming'
            ? differenceInDays(startDate, today)
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

async function calculateSalesProgress(
  goal: PromoGoal,
  teamMemberId: string,
  agencyId: string,
  startDate: string,
  endDate: string
): Promise<number> {
  const measurement = goal.measurement;
  const productTypeId = goal.product_type_id;
  
  if (measurement === 'premium') {
    // Sum total_premium from sales
    const { data, error } = await supabase
      .from("sales")
      .select("total_premium")
      .eq("team_member_id", teamMemberId)
      .eq("agency_id", agencyId)
      .gte("sale_date", startDate)
      .lte("sale_date", endDate);
    
    if (error) throw error;
    return data?.reduce((sum, s) => sum + (s.total_premium || 0), 0) || 0;
  }
  
  if (measurement === 'items') {
    // Sum item_count from sale_items with optional product filter
    let query = supabase
      .from("sale_items")
      .select(`
        item_count,
        sale_policy:sale_policies!inner(
          sale:sales!inner(
            team_member_id,
            agency_id,
            sale_date
          )
        )
      `)
      .eq("sale_policy.sale.team_member_id", teamMemberId)
      .eq("sale_policy.sale.agency_id", agencyId)
      .gte("sale_policy.sale.sale_date", startDate)
      .lte("sale_policy.sale.sale_date", endDate);
    
    if (productTypeId) {
      query = query.eq("product_type_id", productTypeId);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data?.reduce((sum, item) => sum + (item.item_count || 0), 0) || 0;
  }
  
  if (measurement === 'points') {
    // Sum points from sale_items with optional product filter
    let query = supabase
      .from("sale_items")
      .select(`
        points,
        sale_policy:sale_policies!inner(
          sale:sales!inner(
            team_member_id,
            agency_id,
            sale_date
          )
        )
      `)
      .eq("sale_policy.sale.team_member_id", teamMemberId)
      .eq("sale_policy.sale.agency_id", agencyId)
      .gte("sale_policy.sale.sale_date", startDate)
      .lte("sale_policy.sale.sale_date", endDate);
    
    if (productTypeId) {
      query = query.eq("product_type_id", productTypeId);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data?.reduce((sum, item) => sum + (item.points || 0), 0) || 0;
  }
  
  if (measurement === 'policies') {
    // Count distinct policies with optional product filter
    let query = supabase
      .from("sale_policies")
      .select(`
        id,
        sale:sales!inner(
          team_member_id,
          agency_id,
          sale_date
        )
      `)
      .eq("sale.team_member_id", teamMemberId)
      .eq("sale.agency_id", agencyId)
      .gte("sale.sale_date", startDate)
      .lte("sale.sale_date", endDate);
    
    if (productTypeId) {
      query = query.eq("product_type_id", productTypeId);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data?.length || 0;
  }
  
  if (measurement === 'households') {
    // Count distinct customer names
    const { data, error } = await supabase
      .from("sales")
      .select("customer_name")
      .eq("team_member_id", teamMemberId)
      .eq("agency_id", agencyId)
      .gte("sale_date", startDate)
      .lte("sale_date", endDate);
    
    if (error) throw error;
    const uniqueHouseholds = new Set(data?.map(s => s.customer_name) || []);
    return uniqueHouseholds.size;
  }
  
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
  
  return data?.reduce((sum, row) => sum + ((row as any)[column] || 0), 0) || 0;
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
