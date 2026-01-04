import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompPlans } from "./useCompPlans";
import { calculateAllPayouts, convertToPerformance, calculateMemberPayout } from "@/lib/payout-calculator/calculator";
import { PayoutCalculation } from "@/lib/payout-calculator/types";
import { SubProducerMetrics } from "@/lib/allstate-analyzer/sub-producer-analyzer";
import { toast } from "sonner";

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

  // Calculate payouts from sub-producer data
  const calculatePayouts = (
    subProducerData: SubProducerMetrics[] | undefined | null,
    month: number,
    year: number
  ): { payouts: PayoutCalculation[]; warnings: string[] } => {
    // Guard against missing data
    if (!subProducerData || !Array.isArray(subProducerData) || subProducerData.length === 0) {
      return { payouts: [], warnings: ['No sub-producer data available for this statement'] };
    }
    
    return calculateAllPayouts(
      subProducerData,
      plans,
      assignments,
      teamMembers,
      month,
      year
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
