import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BundleConfigs, ProductRates, PointValues, BundlingMultipliers, CommissionModifiers } from "./useCompPlans";

export interface CompPlanFormData {
  id?: string;
  name: string;
  description: string | null;
  payout_type: string;
  tier_metric: string;
  tier_metric_source?: 'written' | 'issued'; // Phase 6: Written vs Issued for tier qualification
  chargeback_rule: string;
  policy_type_filter: string[] | null;
  brokered_payout_type: string;
  brokered_flat_rate: number | null;
  brokered_counts_toward_tier: boolean;
  include_brokered_in_bundling?: boolean;
  is_active: boolean;
  tiers: TierFormData[];
  brokered_tiers: TierFormData[];
  assigned_member_ids: string[];
  // New optional fields for advanced compensation configuration
  bundle_configs?: BundleConfigs | null;
  product_rates?: ProductRates | null;
  // Extended configuration fields (Phase 2)
  point_values?: PointValues | null;
  bundling_multipliers?: BundlingMultipliers | null;
  commission_modifiers?: CommissionModifiers | null;
}

export interface TierFormData {
  id?: string;
  min_threshold: number;
  commission_value: number;
  sort_order: number;
}

interface AssignmentConflict {
  memberId: string;
  memberName: string;
  existingPlanName: string;
}

function buildAssignmentConflictMessage(conflicts: AssignmentConflict[]): string {
  if (conflicts.length === 0) {
    return "One or more team members already have an active compensation plan.";
  }

  if (conflicts.length === 1) {
    const conflict = conflicts[0];
    return `${conflict.memberName} is already assigned to "${conflict.existingPlanName}". Remove them from that plan before assigning them here.`;
  }

  const preview = conflicts
    .slice(0, 3)
    .map((conflict) => `${conflict.memberName} -> ${conflict.existingPlanName}`)
    .join("; ");

  const remaining = conflicts.length - 3;
  return remaining > 0
    ? `${preview}; plus ${remaining} more active plan conflict${remaining === 1 ? "" : "s"}. Remove those assignments before saving.`
    : `${preview}. Remove those assignments before saving.`;
}

export function useCompPlanMutations(agencyId: string | null) {
  const queryClient = useQueryClient();

  const findAssignmentConflicts = async (
    memberIds: string[],
    excludedPlanId?: string
  ): Promise<AssignmentConflict[]> => {
    if (!agencyId || memberIds.length === 0) {
      return [];
    }

    const { data, error } = await supabase
      .from("comp_plan_assignments")
      .select(`
        team_member_id,
        comp_plan_id,
        comp_plans!inner(name, agency_id),
        team_members!inner(name)
      `)
      .in("team_member_id", memberIds)
      .is("end_date", null)
      .eq("comp_plans.agency_id", agencyId);

    if (error) throw error;

    const conflicts: AssignmentConflict[] = [];
    for (const row of data || []) {
      if (excludedPlanId && row.comp_plan_id === excludedPlanId) continue;

      const plan = Array.isArray(row.comp_plans) ? row.comp_plans[0] : row.comp_plans;
      const member = Array.isArray(row.team_members) ? row.team_members[0] : row.team_members;

      conflicts.push({
        memberId: row.team_member_id,
        memberName: member?.name || "This team member",
        existingPlanName: plan?.name || "another compensation plan",
      });
    }

    const deduped = new Map<string, AssignmentConflict>();
    for (const conflict of conflicts) {
      if (!deduped.has(conflict.memberId)) {
        deduped.set(conflict.memberId, conflict);
      }
    }

    return Array.from(deduped.values());
  };

  const createPlan = useMutation({
    mutationFn: async (data: CompPlanFormData) => {
      if (!agencyId) throw new Error("Agency ID required");

      const conflicts = await findAssignmentConflicts(data.assigned_member_ids);
      if (conflicts.length > 0) {
        throw new Error(buildAssignmentConflictMessage(conflicts));
      }

      // 1. Create the comp plan
      const { data: plan, error: planError } = await supabase
        .from("comp_plans")
        .insert({
          agency_id: agencyId,
          name: data.name,
          description: data.description,
          payout_type: data.payout_type,
          tier_metric: data.tier_metric,
          tier_metric_source: data.tier_metric_source || 'written',
          chargeback_rule: data.chargeback_rule,
          policy_type_filter: data.policy_type_filter,
          brokered_payout_type: data.brokered_payout_type,
          brokered_flat_rate: data.brokered_flat_rate,
          brokered_counts_toward_tier: data.brokered_counts_toward_tier,
          include_brokered_in_bundling: data.include_brokered_in_bundling || false,
          is_active: data.is_active,
          bundle_configs: data.bundle_configs || null,
          product_rates: data.product_rates || null,
          point_values: data.point_values || null,
          bundling_multipliers: data.bundling_multipliers || null,
          commission_modifiers: data.commission_modifiers || null,
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

      // 3. Create brokered tiers (if tiered brokered payout)
      if (data.brokered_tiers && data.brokered_tiers.length > 0) {
        const brokeredTiersToInsert = data.brokered_tiers.map((tier, index) => ({
          comp_plan_id: plan.id,
          min_threshold: tier.min_threshold,
          commission_value: tier.commission_value,
          sort_order: index,
        }));

        const { error: brokeredTiersError } = await supabase
          .from("comp_plan_brokered_tiers")
          .insert(brokeredTiersToInsert);

        if (brokeredTiersError) throw brokeredTiersError;
      }

      // 4. Create assignments for the new plan
      if (data.assigned_member_ids.length > 0) {
        const today = format(new Date(), "yyyy-MM-dd");
        const assignmentsToInsert = data.assigned_member_ids.map((memberId) => ({
          comp_plan_id: plan.id,
          team_member_id: memberId,
          effective_date: today,
          end_date: null,
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
      queryClient.invalidateQueries({ queryKey: ["comp-plan-assignments"] });
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

      const conflicts = await findAssignmentConflicts(data.assigned_member_ids, data.id);
      if (conflicts.length > 0) {
        throw new Error(buildAssignmentConflictMessage(conflicts));
      }

      // 1. Update the comp plan
      const { error: planError } = await supabase
        .from("comp_plans")
        .update({
          name: data.name,
          description: data.description,
          payout_type: data.payout_type,
          tier_metric: data.tier_metric,
          tier_metric_source: data.tier_metric_source || 'written',
          chargeback_rule: data.chargeback_rule,
          policy_type_filter: data.policy_type_filter,
          brokered_payout_type: data.brokered_payout_type,
          brokered_flat_rate: data.brokered_flat_rate,
          brokered_counts_toward_tier: data.brokered_counts_toward_tier,
          include_brokered_in_bundling: data.include_brokered_in_bundling || false,
          is_active: data.is_active,
          bundle_configs: data.bundle_configs || null,
          product_rates: data.product_rates || null,
          point_values: data.point_values || null,
          bundling_multipliers: data.bundling_multipliers || null,
          commission_modifiers: data.commission_modifiers || null,
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

      // 3. Delete existing brokered tiers and recreate
      const { error: deleteBrokeredError } = await supabase
        .from("comp_plan_brokered_tiers")
        .delete()
        .eq("comp_plan_id", data.id);

      if (deleteBrokeredError) throw deleteBrokeredError;

      if (data.brokered_tiers && data.brokered_tiers.length > 0) {
        const brokeredTiersToInsert = data.brokered_tiers.map((tier, index) => ({
          comp_plan_id: data.id!,
          min_threshold: tier.min_threshold,
          commission_value: tier.commission_value,
          sort_order: index,
        }));

        const { error: brokeredTiersError } = await supabase
          .from("comp_plan_brokered_tiers")
          .insert(brokeredTiersToInsert);

        if (brokeredTiersError) throw brokeredTiersError;
      }

      // 3. Handle staff assignments
      const today = format(new Date(), 'yyyy-MM-dd');

      // Get ALL assignments for this plan (active and ended) to handle reactivation
      const { data: allPlanAssignments, error: fetchAssignError } = await supabase
        .from('comp_plan_assignments')
        .select('id, team_member_id, end_date')
        .eq('comp_plan_id', data.id);

      if (fetchAssignError) throw fetchAssignError;

      const activeAssignments = (allPlanAssignments || []).filter(a => a.end_date === null);
      const endedAssignments = (allPlanAssignments || []).filter(a => a.end_date !== null);

      const activeMemberIds = new Set(activeAssignments.map(a => a.team_member_id));
      const newMemberIds = new Set(data.assigned_member_ids);

      // End assignments for members no longer in the plan
      const assignmentsToEnd = activeAssignments.filter(
        a => !newMemberIds.has(a.team_member_id)
      );

      if (assignmentsToEnd.length > 0) {
        const { error: endError } = await supabase
          .from('comp_plan_assignments')
          .update({ end_date: today })
          .in('id', assignmentsToEnd.map(a => a.id));

        if (endError) throw endError;
      }

      // Add assignments for members not currently active on this plan
      const membersToAdd = (data.assigned_member_ids || []).filter(
        id => !activeMemberIds.has(id)
      );

      if (membersToAdd.length > 0) {
        // Build a map of ended assignments by member for reactivation
        const endedByMember = new Map<string, string>();
        for (const a of endedAssignments) {
          endedByMember.set(a.team_member_id, a.id);
        }

        const toReactivate: string[] = [];
        const toInsert: string[] = [];

        for (const memberId of membersToAdd) {
          const endedId = endedByMember.get(memberId);
          if (endedId) {
            toReactivate.push(endedId);
          } else {
            toInsert.push(memberId);
          }
        }

        // Reactivate existing ended assignments (clear end_date)
        if (toReactivate.length > 0) {
          const { error: reactivateError } = await supabase
            .from('comp_plan_assignments')
            .update({ end_date: null })
            .in('id', toReactivate);

          if (reactivateError) throw reactivateError;
        }

        // Insert truly new assignments
        if (toInsert.length > 0) {
          const newAssignments = toInsert.map(memberId => ({
            comp_plan_id: data.id!,
            team_member_id: memberId,
            effective_date: today,
            end_date: null,
          }));

          const { error: assignError } = await supabase
            .from('comp_plan_assignments')
            .insert(newAssignments);

          if (assignError) throw assignError;
        }
      }

      // If no members assigned at all, end all existing active assignments
      if (!data.assigned_member_ids || data.assigned_member_ids.length === 0) {
        const { error: endAllError } = await supabase
          .from('comp_plan_assignments')
          .update({ end_date: today })
          .eq('comp_plan_id', data.id)
          .is('end_date', null);

        if (endAllError) throw endAllError;
      }

      return data.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comp-plans"] });
      queryClient.invalidateQueries({ queryKey: ["comp-plan-assignments"] });
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
