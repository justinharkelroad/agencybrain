import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { QuarterlyTargets } from "./useQuarterlyTargets";

export type QuarterlyTargetsSummary = QuarterlyTargets;

export function useQuarterlyTargetsHistory() {
  return useQuery({
    queryKey: ['quarterly-targets-history'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('life_targets_quarterly')
        .select('*')
        .eq('user_id', user.id)
        .order('quarter', { ascending: false });

      if (error) throw error;
      return data as QuarterlyTargetsSummary[];
    },
  });
}

export function useDeleteQuarterlyTargets() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('life_targets_quarterly')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quarterly-targets-history'] });
      toast.success('Quarterly plan deleted successfully');
    },
    onError: (error) => {
      console.error('Delete error:', error);
      toast.error('Failed to delete quarterly plan');
    },
  });
}
