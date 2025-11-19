import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { remapMonthlyMissions } from "@/lib/quarterUtils";

export function useChangeQuarterLabel() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ fromQuarter, toQuarter }: { fromQuarter: string, toQuarter: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      // Check if target quarter already has data
      const { data: existing } = await supabase
        .from('life_targets_quarterly')
        .select('id')
        .eq('user_id', user.id)
        .eq('quarter', toQuarter)
        .maybeSingle();
      
      if (existing) {
        throw new Error('Target quarter already has data. Please choose a different quarter or delete the existing plan first.');
      }
      
      // Fetch existing data to remap missions
      const { data: existingData, error: fetchError } = await supabase
        .from('life_targets_quarterly')
        .select('*')
        .eq('user_id', user.id)
        .eq('quarter', fromQuarter)
        .single();
      
      if (fetchError) throw fetchError;
      
      // Remap all monthly missions to new quarter's months
      const updatedData = {
        ...existingData,
        quarter: toQuarter,
        body_monthly_missions: remapMonthlyMissions(
          existingData.body_monthly_missions,
          fromQuarter,
          toQuarter
        ),
        being_monthly_missions: remapMonthlyMissions(
          existingData.being_monthly_missions,
          fromQuarter,
          toQuarter
        ),
        balance_monthly_missions: remapMonthlyMissions(
          existingData.balance_monthly_missions,
          fromQuarter,
          toQuarter
        ),
        business_monthly_missions: remapMonthlyMissions(
          existingData.business_monthly_missions,
          fromQuarter,
          toQuarter
        ),
      };
      
      // Delete old record
      const { error: deleteError } = await supabase
        .from('life_targets_quarterly')
        .delete()
        .eq('user_id', user.id)
        .eq('quarter', fromQuarter);
      
      if (deleteError) throw deleteError;
      
      // Insert with remapped missions
      const { data, error: insertError } = await supabase
        .from('life_targets_quarterly')
        .insert([updatedData])
        .select()
        .single();
      
      if (insertError) throw insertError;
      return data;
    },
    onSuccess: (_, { fromQuarter, toQuarter }) => {
      queryClient.invalidateQueries({ queryKey: ['quarterly-targets', fromQuarter] });
      queryClient.invalidateQueries({ queryKey: ['quarterly-targets', toQuarter] });
      queryClient.invalidateQueries({ queryKey: ['quarterly-targets-history'] });
      toast.success(`Plan successfully moved to ${toQuarter}`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to move quarter');
    }
  });
}
