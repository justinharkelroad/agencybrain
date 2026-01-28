import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompPlans } from "./useCompPlans";
import { calculateAllPayouts, convertToPerformance, calculateMemberPayout, BrokeredMetrics } from "@/lib/payout-calculator/calculator";
import { PayoutCalculation } from "@/lib/payout-calculator/types";
import { calculateSelfGenMetricsBatch, SelfGenMetrics } from "@/lib/payout-calculator/self-gen";
import { SubProducerMetrics } from "@/lib/allstate-analyzer/sub-producer-analyzer";
import { toast } from "sonner";

// Manual override interface for testing compensation calculations
export interface ManualOverride {
  subProdCode: string;
  teamMemberId: string | null;
  teamMemberName: string | null;
  // Total metrics (for tier qualification)
  writtenItems: number | null;
  writtenPremium: number | null;
  writtenPolicies: number | null;
  writtenHouseholds: number | null;
  writtenPoints: number | null;
  // Bundle breakdown (for commission calculation)
  bundledItems: number | null;
  bundledPremium: number | null;
  monolineItems: number | null;
  monolinePremium: number | null;
}

// Helper function to send payout notifications
async function sendPayoutNotifications(
  payoutIds: string[],
  notificationType: 'finalized' | 'paid',
  agencyId: string
): Promise<{ sent: number; skipped: number; errors?: string[] }> {
  try {
    const { data, error } = await supabase.functions.invoke('send-payout-notification', {
      body: {
        payout_ids: payoutIds,
        notification_type: notificationType,
        agency_id: agencyId,
      },
    });

    if (error) {
      console.error('Error sending payout notifications:', error);
      return { sent: 0, skipped: 0, errors: [error.message] };
    }

    return data || { sent: 0, skipped: 0 };
  } catch (err: any) {
    console.error('Failed to send payout notifications:', err);
    return { sent: 0, skipped: 0, errors: [err.message] };
  }
}


interface TeamMember {
  id: string;
  name: string;
  sub_producer_code: string | null;
}

interface Assignment {
  team_member_id: string;
  comp_plan_id: string;
}

export interface CompPayout {
  id: string;
  team_member_id: string;
  agency_id: string;
  comp_plan_id: string | null;
  period_month: number;
  period_year: number;
  written_premium: number | null;
  written_items: number | null;
  written_policies: number | null;
  written_households: number | null;
  written_points: number | null;
  issued_premium: number | null;
  issued_items: number | null;
  issued_policies: number | null;
  issued_points: number | null;
  chargeback_premium: number | null;
  chargeback_count: number | null;
  net_premium: number | null;
  net_items: number | null;
  tier_threshold_met: number | null;
  tier_commission_value: number | null;
  base_commission: number | null;
  bonus_amount: number | null;
  total_payout: number | null;
  rollover_premium: number | null;
  status: string | null;
  finalized_at: string | null;
  paid_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  // Phase 3/8: Audit trail fields
  self_gen_percent: number | null;
  self_gen_met_requirement: boolean | null;
  self_gen_penalty_amount: number | null;
  self_gen_bonus_amount: number | null;
  bundling_percent: number | null;
  bundling_multiplier: number | null;
  brokered_commission: number | null;
  chargeback_details_json: unknown | null;
  calculation_snapshot_json: unknown | null;
}

// Fetch brokered business metrics from sales data for a given period
async function fetchBrokeredMetrics(
  agencyId: string,
  month: number,
  year: number
): Promise<Map<string, BrokeredMetrics>> {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];

  const { data: sales, error } = await supabase
    .from("sales")
    .select(`
      team_member_id,
      brokered_carrier_id,
      total_items,
      total_premium,
      total_policies
    `)
    .eq("agency_id", agencyId)
    .not("brokered_carrier_id", "is", null)
    .gte("sale_date", startStr)
    .lte("sale_date", endStr);

  if (error) {
    console.error("Error fetching brokered metrics:", error);
    return new Map();
  }

  const brokeredByMember = new Map<string, BrokeredMetrics>();
  const householdsByMember = new Map<string, Set<string>>();

  for (const sale of sales || []) {
    if (!sale.team_member_id) continue;

    const current = brokeredByMember.get(sale.team_member_id) || {
      items: 0,
      premium: 0,
      policies: 0,
      households: 0,
    };

    current.items += sale.total_items || 0;
    current.premium += sale.total_premium || 0;
    current.policies += sale.total_policies || 0;

    // Track unique households (sales)
    let householdSet = householdsByMember.get(sale.team_member_id);
    if (!householdSet) {
      householdSet = new Set();
      householdsByMember.set(sale.team_member_id, householdSet);
    }
    householdSet.add(sale.team_member_id); // Each sale = 1 household

    brokeredByMember.set(sale.team_member_id, current);
  }

  // Update household counts
  for (const [memberId, householdSet] of householdsByMember) {
    const metrics = brokeredByMember.get(memberId);
    if (metrics) {
      metrics.households = householdSet.size;
    }
  }

  return brokeredByMember;
}

export function usePayoutCalculator(agencyId: string | null) {
  const queryClient = useQueryClient();
  const { data: plans = [] } = useCompPlans(agencyId);

  // Fetch team members with sub_producer_code
  const { data: teamMembers = [] } = useQuery<TeamMember[]>({
    queryKey: ["team-members-for-payouts", agencyId],
    enabled: !!agencyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("id, name, sub_producer_code")
        .eq("agency_id", agencyId!)
        .eq("status", "active");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch all active assignments
  const { data: assignments = [] } = useQuery<Assignment[]>({
    queryKey: ["comp-plan-assignments", agencyId],
    enabled: !!agencyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comp_plan_assignments")
        .select("team_member_id, comp_plan_id")
        .is("end_date", null);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch existing payouts for a period
  const fetchPayouts = async (month: number, year: number): Promise<CompPayout[]> => {
    if (!agencyId) return [];
    
    const { data, error } = await supabase
      .from("comp_payouts")
      .select("*")
      .eq("agency_id", agencyId)
      .eq("period_month", month)
      .eq("period_year", year);
    
    if (error) throw error;
    return data || [];
  };

  // Calculate payouts from sub-producer data (async for promo bonus calculation)
  const calculatePayouts = async (
    subProducerData: SubProducerMetrics[] | undefined | null,
    month: number,
    year: number,
    manualOverrides?: ManualOverride[]
  ): Promise<{ payouts: PayoutCalculation[]; warnings: string[] }> => {
    // Guard against missing data
    if (!subProducerData || !Array.isArray(subProducerData) || subProducerData.length === 0) {
      return { payouts: [], warnings: ['No sub-producer data available for this statement'] };
    }

    if (!agencyId) {
      return { payouts: [], warnings: ['No agency ID available'] };
    }

    // Get period dates for batch queries
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0); // Last day of month

    // Get team member IDs for batch queries
    const teamMemberIds = teamMembers.map(tm => tm.id);

    // Fetch full self-gen metrics using batch function (Phase 3)
    const selfGenMetricsByMember = await calculateSelfGenMetricsBatch(
      agencyId,
      teamMemberIds,
      startDate,
      endDate
    );

    // Build legacy selfGenByMember map from the metrics (for backward compatibility)
    const selfGenByMember = new Map<string, number>();
    for (const [memberId, metrics] of selfGenMetricsByMember) {
      selfGenByMember.set(memberId, metrics.selfGenItems);
    }

    // Fetch brokered business metrics (Phase 5)
    const brokeredMetricsByMember = await fetchBrokeredMetrics(agencyId, month, year);

    return await calculateAllPayouts(
      subProducerData,
      plans,
      assignments,
      teamMembers,
      month,
      year,
      agencyId,
      manualOverrides,
      selfGenByMember,
      selfGenMetricsByMember,
      brokeredMetricsByMember
    );
  };

  // Save payouts to database
  const savePayoutsMutation = useMutation({
    mutationFn: async (payouts: PayoutCalculation[]) => {
      if (!agencyId) throw new Error("No agency ID");
      
      const payoutRows = payouts.map(p => ({
        team_member_id: p.teamMemberId,
        agency_id: agencyId,
        comp_plan_id: p.compPlanId,
        period_month: p.periodMonth,
        period_year: p.periodYear,
        written_premium: p.writtenPremium,
        written_items: p.writtenItems,
        written_policies: p.writtenPolicies,
        written_households: p.writtenHouseholds,
        written_points: p.writtenPoints,
        issued_premium: p.issuedPremium,
        issued_items: p.issuedItems,
        issued_policies: p.issuedPolicies,
        issued_points: p.issuedPoints,
        chargeback_premium: p.chargebackPremium,
        chargeback_count: p.chargebackCount,
        net_premium: p.netPremium,
        net_items: p.netItems,
        tier_threshold_met: p.tierThresholdMet,
        tier_commission_value: p.tierCommissionValue,
        base_commission: p.baseCommission,
        bonus_amount: p.bonusAmount,
        total_payout: p.totalPayout,
        rollover_premium: p.rolloverPremium,
        status: p.status,
        // Phase 3/8: Audit trail fields
        self_gen_percent: p.selfGenPercent ?? null,
        self_gen_met_requirement: p.selfGenMetRequirement ?? null,
        self_gen_penalty_amount: p.selfGenPenaltyAmount ?? 0,
        self_gen_bonus_amount: p.selfGenBonusAmount ?? 0,
        bundling_percent: p.bundlingPercent ?? null,
        bundling_multiplier: p.bundlingMultiplier ?? 1,
        brokered_commission: p.brokeredCommission ?? 0,
        chargeback_details_json: p.chargebackDetails ?? null,
        calculation_snapshot_json: p.calculationSnapshot ?? null,
      }));

      // Upsert payouts (update if exists for same member/period)
      const { error } = await supabase
        .from("comp_payouts")
        .upsert(payoutRows, {
          onConflict: "team_member_id,period_month,period_year",
        });

      if (error) throw error;
      return payouts.length;
    },
    onSuccess: (count) => {
      toast.success(`Saved ${count} payout calculations`);
      queryClient.invalidateQueries({ queryKey: ["comp-payouts"] });
    },
    onError: (error) => {
      console.error("Error saving payouts:", error);
      toast.error("Failed to save payouts");
    },
  });

  // Finalize payouts
  const finalizePayoutsMutation = useMutation({
    mutationFn: async ({ month, year }: { month: number; year: number }) => {
      if (!agencyId) throw new Error("No agency ID");
      
      const { error } = await supabase
        .from("comp_payouts")
        .update({ 
          status: "finalized", 
          finalized_at: new Date().toISOString() 
        })
        .eq("agency_id", agencyId)
        .eq("period_month", month)
        .eq("period_year", year)
        .eq("status", "draft");

      if (error) throw error;
      return { month, year };
    },
    onSuccess: async ({ month, year }) => {
      toast.success("Payouts finalized");
      queryClient.invalidateQueries({ queryKey: ["comp-payouts"] });

      // Send notification emails
      if (agencyId) {
        const { data: payouts } = await supabase
          .from("comp_payouts")
          .select("id")
          .eq("agency_id", agencyId)
          .eq("period_month", month)
          .eq("period_year", year)
          .eq("status", "finalized");

        if (payouts && payouts.length > 0) {
          const payoutIds = payouts.map(p => p.id);
          const result = await sendPayoutNotifications(payoutIds, 'finalized', agencyId);
          
          if (result.sent > 0) {
            toast.success(`Statement emails sent to ${result.sent} team member${result.sent !== 1 ? 's' : ''}`);
          }
          if (result.errors && result.errors.length > 0) {
            toast.error("Some notification emails failed to send");
          }
        }
      }
    },
    onError: (error) => {
      console.error("Error finalizing payouts:", error);
      toast.error("Failed to finalize payouts");
    },
  });

  // Mark payouts as paid
  const markPaidMutation = useMutation({
    mutationFn: async ({ month, year }: { month: number; year: number }) => {
      if (!agencyId) throw new Error("No agency ID");
      
      const { error } = await supabase
        .from("comp_payouts")
        .update({ 
          status: "paid", 
          paid_at: new Date().toISOString() 
        })
        .eq("agency_id", agencyId)
        .eq("period_month", month)
        .eq("period_year", year)
        .eq("status", "finalized");

      if (error) throw error;
      return { month, year };
    },
    onSuccess: async ({ month, year }) => {
      toast.success("Payouts marked as paid");
      queryClient.invalidateQueries({ queryKey: ["comp-payouts"] });

      // Send notification emails
      if (agencyId) {
        const { data: payouts } = await supabase
          .from("comp_payouts")
          .select("id")
          .eq("agency_id", agencyId)
          .eq("period_month", month)
          .eq("period_year", year)
          .eq("status", "paid");

        if (payouts && payouts.length > 0) {
          const payoutIds = payouts.map(p => p.id);
          const result = await sendPayoutNotifications(payoutIds, 'paid', agencyId);
          
          if (result.sent > 0) {
            toast.success(`Payment confirmation emails sent to ${result.sent} team member${result.sent !== 1 ? 's' : ''}`);
          }
          if (result.errors && result.errors.length > 0) {
            toast.error("Some notification emails failed to send");
          }
        }
      }
    },
    onError: (error) => {
      console.error("Error marking payouts as paid:", error);
      toast.error("Failed to mark payouts as paid");
    },
  });

  return {
    plans,
    teamMembers,
    assignments,
    calculatePayouts,
    fetchPayouts,
    savePayouts: savePayoutsMutation.mutate,
    savePayoutsAsync: savePayoutsMutation.mutateAsync,
    isSaving: savePayoutsMutation.isPending,
    finalizePayouts: finalizePayoutsMutation.mutate,
    isFinalizingPayouts: finalizePayoutsMutation.isPending,
    markPaid: markPaidMutation.mutate,
    isMarkingPaid: markPaidMutation.isPending,
  };
}
