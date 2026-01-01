import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';

export function useDeleteProspect() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (prospectId: string) => {
      // First delete any sold_policy_details linked to this prospect
      const { error: soldError } = await supabase
        .from('sold_policy_details')
        .delete()
        .eq('quoted_household_detail_id', prospectId);

      if (soldError) throw soldError;

      // Then delete the prospect
      const { error } = await supabase
        .from('quoted_household_details')
        .delete()
        .eq('id', prospectId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['explorer'] });
      toast.success('Record deleted');
    },
    onError: () => {
      toast.error('Failed to delete record');
    },
  });
}

export function useDeleteAllExplorerData() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (agencyId: string) => {
      // Delete sold_policy_details first (they reference quoted_household_details)
      const { error: soldError } = await supabase
        .from('sold_policy_details')
        .delete()
        .in('quoted_household_detail_id', 
          supabase
            .from('quoted_household_details')
            .select('id')
            .eq('agency_id', agencyId)
        );

      // Note: The above subquery approach may not work. Let's delete via a join approach instead
      // First get all prospect ids for this agency
      const { data: prospects, error: fetchError } = await supabase
        .from('quoted_household_details')
        .select('id')
        .eq('agency_id', agencyId);

      if (fetchError) throw fetchError;

      if (prospects && prospects.length > 0) {
        const prospectIds = prospects.map(p => p.id);
        
        // Delete sold policy details linked to these prospects
        const { error: soldDeleteError } = await supabase
          .from('sold_policy_details')
          .delete()
          .in('quoted_household_detail_id', prospectIds);

        if (soldDeleteError) throw soldDeleteError;
      }

      // Then delete all prospects for this agency
      const { error: prospectsError } = await supabase
        .from('quoted_household_details')
        .delete()
        .eq('agency_id', agencyId);

      if (prospectsError) throw prospectsError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['explorer'] });
      toast.success('All explorer data deleted');
    },
    onError: () => {
      toast.error('Failed to delete explorer data');
    },
  });
}
