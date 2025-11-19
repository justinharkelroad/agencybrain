import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useFixQuarterMonths() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (quarter: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      console.log(`Fixing month labels for quarter ${quarter}...`);

      const { data, error } = await supabase.functions.invoke('fix_quarter_months', {
        body: {
          userId: user.id,
          quarter,
        }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      return data;
    },
    onSuccess: (_, quarter) => {
      queryClient.invalidateQueries({ queryKey: ['quarterly-targets', quarter] });
      queryClient.invalidateQueries({ queryKey: ['quarterly-targets-history'] });
      toast.success('Month labels corrected!');
    },
    onError: (error) => {
      console.error('Fix quarter months error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to fix month labels');
    }
  });
}
