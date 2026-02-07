import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { CoachingThresholds } from '@/types/coaching';
import { DEFAULT_COACHING_THRESHOLDS } from '@/types/coaching';

export function useCoachingThresholds(agencyId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['coaching-thresholds', agencyId],
    enabled: !!agencyId,
    staleTime: 60_000,
    queryFn: async (): Promise<CoachingThresholds> => {
      const { data, error } = await supabase
        .from('coaching_insight_settings')
        .select('thresholds')
        .eq('agency_id', agencyId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return { ...DEFAULT_COACHING_THRESHOLDS };
      return { ...DEFAULT_COACHING_THRESHOLDS, ...(data.thresholds as Partial<CoachingThresholds>) };
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (thresholds: CoachingThresholds) => {
      const { error } = await supabase
        .from('coaching_insight_settings')
        .upsert(
          {
            agency_id: agencyId!,
            thresholds: thresholds as unknown as Record<string, unknown>,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'agency_id' }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coaching-thresholds', agencyId] });
    },
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('coaching_insight_settings')
        .upsert(
          {
            agency_id: agencyId!,
            thresholds: DEFAULT_COACHING_THRESHOLDS as unknown as Record<string, unknown>,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'agency_id' }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coaching-thresholds', agencyId] });
    },
  });

  return {
    thresholds: query.data ?? DEFAULT_COACHING_THRESHOLDS,
    isLoading: query.isLoading,
    save: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    reset: resetMutation.mutateAsync,
    isResetting: resetMutation.isPending,
  };
}
