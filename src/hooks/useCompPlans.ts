import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CompPlanTier {
  id: string;
  min_threshold: number;
  commission_value: number;
  sort_order: number;
}

export interface CompPlan {
  id: string;
  agency_id: string;
  name: string;
  description: string | null;
  payout_type: string;
  tier_metric: string;
  chargeback_rule: string;
  brokered_flat_rate: number | null;
  brokered_counts_toward_tier: boolean | null;
  policy_type_filter: string[] | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  tiers: CompPlanTier[];
  assigned_count: number;
}

export function useCompPlans(agencyId: string | null) {
  return useQuery({
    queryKey: ["comp-plans", agencyId],
    queryFn: async () => {
      if (!agencyId) return [];

      // Fetch plans
      const { data: plans, error: plansError } = await supabase
        .from("comp_plans")
        .select("*")
        .eq("agency_id", agencyId)
        .order("name");

      if (plansError) throw plansError;
      if (!plans || plans.length === 0) return [];

      // Fetch all tiers for these plans
      const planIds = plans.map((p) => p.id);
      const { data: tiers, error: tiersError } = await supabase
        .from("comp_plan_tiers")
        .select("*")
        .in("comp_plan_id", planIds)
        .order("sort_order");

      if (tiersError) throw tiersError;

      // Fetch assignment counts
      const { data: assignments, error: assignmentsError } = await supabase
        .from("comp_plan_assignments")
        .select("comp_plan_id")
        .in("comp_plan_id", planIds)
        .is("end_date", null);

      if (assignmentsError) throw assignmentsError;

      // Count assignments per plan
      const assignmentCounts: Record<string, number> = {};
      (assignments || []).forEach((a) => {
        assignmentCounts[a.comp_plan_id] = (assignmentCounts[a.comp_plan_id] || 0) + 1;
      });

      // Combine plans with their tiers and counts
      return plans.map((plan) => ({
        ...plan,
        tiers: (tiers || []).filter((t) => t.comp_plan_id === plan.id),
        assigned_count: assignmentCounts[plan.id] || 0,
      })) as CompPlan[];
    },
    enabled: !!agencyId,
  });
}
