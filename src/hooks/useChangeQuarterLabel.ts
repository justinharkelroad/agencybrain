import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
      
      // Update the quarter field
      const { data, error } = await supabase
        .from('life_targets_quarterly')
        .update({ quarter: toQuarter })
        .eq('user_id', user.id)
        .eq('quarter', fromQuarter)
        .select()
        .single();
      
      if (error) throw error;
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
