import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CompPlanFormData {
  id?: string;
  name: string;
  description: string | null;
  payout_type: string;
  tier_metric: string;
  chargeback_rule: string;
  policy_type_filter: string[] | null;
  brokered_flat_rate: number | null;
  brokered_counts_toward_tier: boolean;
  is_active: boolean;
  tiers: TierFormData[];
  assigned_member_ids: string[];
}

export interface TierFormData {
  id?: string;
  min_threshold: number;
  commission_value: number;
  sort_order: number;
}

export function useCompPlanMutations(agencyId: string | null) {
  const queryClient = useQueryClient();

  const createPlan = useMutation({
    mutationFn: async (data: CompPlanFormData) => {
      if (!agencyId) throw new Error("Agency ID required");

      // 1. Create the comp plan
      const { data: plan, error: planError } = await supabase
        .from("comp_plans")
        .insert({
          agency_id: agencyId,
          name: data.name,
          description: data.description,
          payout_type: data.payout_type,
          tier_metric: data.tier_metric,
          chargeback_rule: data.chargeback_rule,
          policy_type_filter: data.policy_type_filter,
          brokered_flat_rate: data.brokered_flat_rate,
          brokered_counts_toward_tier: data.brokered_counts_toward_tier,
          is_active: data.is_active,
        })
        .select("id")
        .single();

      if (planError) throw planError;

      // 2. Create tiers
      if (data.tiers.length > 0) {
        const tiersToInsert = data.tiers.map((tier, index) => ({
          comp_plan_id: plan.id,
          min_threshold: tier.min_threshold,
          commission_value: tier.commission_value,
          sort_order: index,
        }));

        const { error: tiersError } = await supabase
          .from("comp_plan_tiers")
          .insert(tiersToInsert);

        if (tiersError) throw tiersError;
      }

      // 3. Create assignments
      if (data.assigned_member_ids.length > 0) {
        const assignmentsToInsert = data.assigned_member_ids.map((memberId) => ({
          comp_plan_id: plan.id,
          team_member_id: memberId,
          effective_date: new Date().toISOString().split("T")[0],
        }));

        const { error: assignError } = await supabase
          .from("comp_plan_assignments")
          .insert(assignmentsToInsert);

        if (assignError) throw assignError;
      }

      return plan;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comp-plans"] });
      toast.success("Compensation plan created");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create plan: ${error.message}`);
      console.error(error);
    },
  });

  const updatePlan = useMutation({
    mutationFn: async (data: CompPlanFormData) => {
      if (!data.id) throw new Error("Plan ID required for update");

      // 1. Update the comp plan
      const { error: planError } = await supabase
        .from("comp_plans")
        .update({
          name: data.name,
          description: data.description,
          payout_type: data.payout_type,
          tier_metric: data.tier_metric,
          chargeback_rule: data.chargeback_rule,
          policy_type_filter: data.policy_type_filter,
          brokered_flat_rate: data.brokered_flat_rate,
          brokered_counts_toward_tier: data.brokered_counts_toward_tier,
          is_active: data.is_active,
        })
        .eq("id", data.id);

      if (planError) throw planError;

      // 2. Delete existing tiers and recreate
      const { error: deleteError } = await supabase
        .from("comp_plan_tiers")
        .delete()
        .eq("comp_plan_id", data.id);

      if (deleteError) throw deleteError;

      if (data.tiers.length > 0) {
        const tiersToInsert = data.tiers.map((tier, index) => ({
          comp_plan_id: data.id!,
          min_threshold: tier.min_threshold,
          commission_value: tier.commission_value,
          sort_order: index,
        }));

        const { error: tiersError } = await supabase
          .from("comp_plan_tiers")
          .insert(tiersToInsert);

        if (tiersError) throw tiersError;
      }

      // 3. Update assignments - end existing and create new
      // First, end all current assignments
      const { error: endError } = await supabase
        .from("comp_plan_assignments")
        .update({ end_date: new Date().toISOString().split("T")[0] })
        .eq("comp_plan_id", data.id)
        .is("end_date", null);

      if (endError) throw endError;

      // Create new assignments
      if (data.assigned_member_ids.length > 0) {
        const assignmentsToInsert = data.assigned_member_ids.map((memberId) => ({
          comp_plan_id: data.id!,
          team_member_id: memberId,
          effective_date: new Date().toISOString().split("T")[0],
        }));

        const { error: assignError } = await supabase
          .from("comp_plan_assignments")
          .insert(assignmentsToInsert);

        if (assignError) throw assignError;
      }

      return data.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comp-plans"] });
      toast.success("Compensation plan updated");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update plan: ${error.message}`);
      console.error(error);
    },
  });

  const deletePlan = useMutation({
    mutationFn: async (planId: string) => {
      const { error } = await supabase
        .from("comp_plans")
        .delete()
        .eq("id", planId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comp-plans"] });
      toast.success("Compensation plan deleted");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete plan: ${error.message}`);
      console.error(error);
    },
  });

  return {
    createPlan,
    updatePlan,
    deletePlan,
  };
}
