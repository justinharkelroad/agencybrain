import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface QuarterlyTargets {
  id?: string;
  user_id?: string;
  quarter: string;
  // Target 1 (primary by default)
  body_target: string | null;
  body_narrative: string | null;
  body_daily_habit: string | null;
  body_monthly_missions: any;
  // Target 2 (secondary)
  body_target2?: string | null;
  body_narrative2?: string | null;
  body_primary_is_target1?: boolean | null;
  
  being_target: string | null;
  being_narrative: string | null;
  being_daily_habit: string | null;
  being_monthly_missions: any;
  being_target2?: string | null;
  being_narrative2?: string | null;
  being_primary_is_target1?: boolean | null;
  
  balance_target: string | null;
  balance_narrative: string | null;
  balance_daily_habit: string | null;
  balance_monthly_missions: any;
  balance_target2?: string | null;
  balance_narrative2?: string | null;
  balance_primary_is_target1?: boolean | null;
  
  business_target: string | null;
  business_narrative: string | null;
  business_daily_habit: string | null;
  business_monthly_missions: any;
  business_target2?: string | null;
  business_narrative2?: string | null;
  business_primary_is_target1?: boolean | null;
  
  created_at?: string;
  updated_at?: string;
}

export function useQuarterlyTargets(quarter: string) {
  return useQuery({
    queryKey: ['quarterly-targets', quarter],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('life_targets_quarterly')
        .select('*')
        .eq('quarter', quarter)
        .maybeSingle();

      if (error) throw error;
      return data as QuarterlyTargets | null;
    },
    enabled: !!quarter
  });
}

export function useSaveQuarterlyTargets() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (targets: QuarterlyTargets) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const payload = {
        user_id: user.id,
        quarter: targets.quarter,
        body_target: targets.body_target,
        body_target2: targets.body_target2,
        body_narrative: targets.body_narrative,
        body_narrative2: targets.body_narrative2,
        body_primary_is_target1: targets.body_primary_is_target1,
        body_daily_habit: targets.body_daily_habit,
        body_monthly_missions: targets.body_monthly_missions,
        being_target: targets.being_target,
        being_target2: targets.being_target2,
        being_narrative: targets.being_narrative,
        being_narrative2: targets.being_narrative2,
        being_primary_is_target1: targets.being_primary_is_target1,
        being_daily_habit: targets.being_daily_habit,
        being_monthly_missions: targets.being_monthly_missions,
        balance_target: targets.balance_target,
        balance_target2: targets.balance_target2,
        balance_narrative: targets.balance_narrative,
        balance_narrative2: targets.balance_narrative2,
        balance_primary_is_target1: targets.balance_primary_is_target1,
        balance_daily_habit: targets.balance_daily_habit,
        balance_monthly_missions: targets.balance_monthly_missions,
        business_target: targets.business_target,
        business_target2: targets.business_target2,
        business_narrative: targets.business_narrative,
        business_narrative2: targets.business_narrative2,
        business_primary_is_target1: targets.business_primary_is_target1,
        business_daily_habit: targets.business_daily_habit,
        business_monthly_missions: targets.business_monthly_missions,
      };

      if (targets.id) {
        const { data, error } = await supabase
          .from('life_targets_quarterly')
          .update(payload)
          .eq('id', targets.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('life_targets_quarterly')
          .insert([payload])
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['quarterly-targets'] });
      toast.success('Targets saved successfully');
    },
    onError: (error) => {
      console.error('Save targets error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save targets');
    }
  });
}
