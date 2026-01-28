import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CompPlanTier {
  id: string;
  min_threshold: number;
  commission_value: number;
  sort_order: number;
}

// Bundle type configuration for Monoline, Standard, or Preferred bundles
export interface BundleTypeConfig {
  enabled: boolean;
  payout_type: string; // 'flat_per_item' | 'percent_of_premium' | 'flat_per_policy' | 'flat_per_household'
  rate?: number; // Simple rate when not using tiers
  tiers?: Array<{ min_threshold: number; commission_value: number }>;
}

// All bundle configurations
export interface BundleConfigs {
  monoline?: BundleTypeConfig;
  standard?: BundleTypeConfig;
  preferred?: BundleTypeConfig;
}

// Product-specific rate configuration
export interface ProductRateConfig {
  payout_type: string;
  rate: number;
}

// All product rate configurations
export interface ProductRates {
  [productName: string]: ProductRateConfig;
}

// Point values per product for tier qualification (when tier_metric = 'points')
export interface PointValues {
  [productName: string]: number;
}

// Bundling multiplier threshold
export interface BundlingThreshold {
  min_percent: number;
  multiplier: number;
}

// Bundling multipliers configuration
export interface BundlingMultipliers {
  thresholds: BundlingThreshold[];
}

// Self-gen requirement configuration (with penalty support)
export interface SelfGenRequirement {
  enabled?: boolean; // New: explicit enable flag
  min_percent: number;
  source: 'written' | 'issued';
  affects_qualification?: boolean; // Legacy
  affects_payout?: boolean; // Legacy
  // Phase 3: Penalty configuration
  penalty_type?: 'percent_reduction' | 'flat_reduction' | 'tier_demotion';
  penalty_value?: number;
}

// Self-gen kicker bonus configuration (legacy)
export interface SelfGenKicker {
  enabled: boolean;
  type: 'per_item' | 'per_policy' | 'per_household';
  amount: number;
  min_self_gen_percent: number;
}

// Self-gen bonus configuration (Phase 3)
export interface SelfGenBonusConfig {
  enabled: boolean;
  min_percent: number;
  bonus_type: 'percent_boost' | 'flat_bonus' | 'per_item' | 'per_policy' | 'per_household' | 'tier_promotion';
  bonus_value: number;
}

// Commission modifiers (self-gen requirements, penalties, and bonuses)
export interface CommissionModifiers {
  self_gen_requirement?: SelfGenRequirement;
  self_gen_kicker?: SelfGenKicker;
  self_gen_bonus?: SelfGenBonusConfig; // Phase 3: New bonus configuration
}

export interface CompPlan {
  id: string;
  agency_id: string;
  name: string;
  description: string | null;
  payout_type: string;
  tier_metric: string;
  tier_metric_source: 'written' | 'issued'; // Phase 6: Written vs Issued for tier qualification
  chargeback_rule: string;
  brokered_flat_rate: number | null;
  brokered_payout_type: string | null;
  brokered_counts_toward_tier: boolean | null;
  policy_type_filter: string[] | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  tiers: CompPlanTier[];
  brokered_tiers: CompPlanTier[];
  assigned_count: number;
  // New optional bundle and product configuration fields
  bundle_configs: BundleConfigs | null;
  product_rates: ProductRates | null;
  // Extended configuration fields (Phase 2)
  point_values: PointValues | null;
  bundling_multipliers: BundlingMultipliers | null;
  commission_modifiers: CommissionModifiers | null;
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

      // Fetch brokered tiers for these plans
      const { data: brokeredTiers, error: brokeredTiersError } = await supabase
        .from("comp_plan_brokered_tiers")
        .select("*")
        .in("comp_plan_id", planIds)
        .order("sort_order");

      if (brokeredTiersError) throw brokeredTiersError;

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
        brokered_tiers: (brokeredTiers || []).filter((t) => t.comp_plan_id === plan.id),
        assigned_count: assignmentCounts[plan.id] || 0,
      })) as CompPlan[];
    },
    enabled: !!agencyId,
  });
}
