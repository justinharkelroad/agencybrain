import { useMutation, useQueryClient } from "@tanstack/react-query";
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
          tier_metric_source: data.tier_metric_source || 'written',
          chargeback_rule: data.chargeback_rule,
          policy_type_filter: data.policy_type_filter,
          brokered_payout_type: data.brokered_payout_type,
          brokered_flat_rate: data.brokered_flat_rate,
          brokered_counts_toward_tier: data.brokered_counts_toward_tier,
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

      // 4. Create assignments using UPSERT to handle re-assignment on same day
      if (data.assigned_member_ids.length > 0) {
        const today = new Date().toISOString().split("T")[0];
        const assignmentsToUpsert = data.assigned_member_ids.map((memberId) => ({
          comp_plan_id: plan.id,
          team_member_id: memberId,
          effective_date: today,
          end_date: null,
        }));

        const { error: assignError } = await supabase
          .from("comp_plan_assignments")
          .upsert(assignmentsToUpsert, { 
            onConflict: 'comp_plan_id,team_member_id,effective_date' 
          });

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
          tier_metric_source: data.tier_metric_source || 'written',
          chargeback_rule: data.chargeback_rule,
          policy_type_filter: data.policy_type_filter,
          brokered_payout_type: data.brokered_payout_type,
          brokered_flat_rate: data.brokered_flat_rate,
          brokered_counts_toward_tier: data.brokered_counts_toward_tier,
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

      // 3. Handle staff assignments - use upsert logic to avoid duplicate key errors
      if (data.assigned_member_ids && data.assigned_member_ids.length > 0) {
        const today = new Date().toISOString().split('T')[0];
        
        // First, get existing active assignments for this plan
        const { data: existingAssignments } = await supabase
          .from('comp_plan_assignments')
          .select('id, team_member_id')
          .eq('comp_plan_id', data.id)
          .is('end_date', null);
        
        const existingMemberIds = new Set(
          (existingAssignments || []).map(a => a.team_member_id)
        );
        const newMemberIds = new Set(data.assigned_member_ids);
        
        // End assignments for members no longer in the plan
        const membersToRemove = (existingAssignments || []).filter(
          a => !newMemberIds.has(a.team_member_id)
        );
        
        if (membersToRemove.length > 0) {
          const { error: endError } = await supabase
            .from('comp_plan_assignments')
            .update({ end_date: today })
            .in('id', membersToRemove.map(a => a.id));
          
          if (endError) throw endError;
        }
        
        // Add assignments for new members only (not already assigned)
        const membersToAdd = data.assigned_member_ids.filter(
          id => !existingMemberIds.has(id)
        );
        
        if (membersToAdd.length > 0) {
          const newAssignments = membersToAdd.map(memberId => ({
            comp_plan_id: data.id!,
            team_member_id: memberId,
            effective_date: today,
            end_date: null,
          }));
          
          // Use UPSERT to handle re-assignment on same day (reactivates ended assignment)
          const { error: assignError } = await supabase
            .from('comp_plan_assignments')
            .upsert(newAssignments, { 
              onConflict: 'comp_plan_id,team_member_id,effective_date' 
            });
          
          if (assignError) throw assignError;
        }
      } else {
        // No members assigned - end all existing assignments
        const today = new Date().toISOString().split('T')[0];
        const { error: endError } = await supabase
          .from('comp_plan_assignments')
          .update({ end_date: today })
          .eq('comp_plan_id', data.id)
          .is('end_date', null);
        
        if (endError) throw endError;
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
