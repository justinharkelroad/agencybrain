import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { DailyActionsOutput } from "./useDailyActions";

interface SaveDailyActionsParams {
  quarter: string;
  selectedActions: Record<string, string[]>;
  showToast?: boolean;
}

export function useSaveDailyActions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ quarter, selectedActions, showToast = true }: SaveDailyActionsParams) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      console.log(`💾 Saving daily actions to database for ${quarter}...`, selectedActions);

      const { error } = await supabase
        .from('life_targets_quarterly')
        .update({
          body_daily_actions: selectedActions.body || [],
          being_daily_actions: selectedActions.being || [],
          balance_daily_actions: selectedActions.balance || [],
          business_daily_actions: selectedActions.business || [],
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .eq('quarter', quarter);

      if (error) throw error;

      if (showToast) {
        toast.success('Daily actions saved');
      }

      return { quarter, selectedActions };
    },
    onSuccess: ({ quarter }) => {
      queryClient.invalidateQueries({ queryKey: ['quarterly-targets', quarter] });
      queryClient.invalidateQueries({ queryKey: ['quarterly-targets-history'] });
    },
    onError: (error) => {
      console.error('Save daily actions error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save daily actions');
    }
  });
}
