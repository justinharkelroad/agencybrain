import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { CoachingInsightConfig, CoachingThresholds } from '@/types/coaching';
import { DEFAULT_COACHING_INSIGHT_CONFIG, mergeCoachingInsightConfig } from '@/types/coaching';

type CoachingInsightSettingsRow = {
  thresholds: CoachingThresholds;
  feature_flags: CoachingInsightConfig['featureFlags'];
  analysis_windows: CoachingInsightConfig['windows'];
  benchmark_config: CoachingInsightConfig['benchmarkConfig'];
  suggestion_templates: CoachingInsightConfig['suggestionTemplates'];
};

export function useCoachingThresholds(agencyId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['coaching-insight-config', agencyId],
    enabled: !!agencyId,
    staleTime: 60_000,
    queryFn: async (): Promise<CoachingInsightConfig> => {
      const { data, error } = await supabase
        .from('coaching_insight_settings')
        .select('*')
        .eq('agency_id', agencyId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return DEFAULT_COACHING_INSIGHT_CONFIG;
      const row = data as unknown as CoachingInsightSettingsRow;
      return mergeCoachingInsightConfig({
        thresholds: (row.thresholds || undefined) as CoachingInsightConfig['thresholds'],
        featureFlags: row.feature_flags,
        windows: row.analysis_windows,
        benchmarkConfig: row.benchmark_config,
        suggestionTemplates: row.suggestion_templates,
      });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (settings: CoachingInsightConfig) => {
      const { error } = await supabase
        .from('coaching_insight_settings')
        .upsert(
          {
            agency_id: agencyId!,
            thresholds: settings.thresholds as unknown as Record<string, unknown>,
            feature_flags: settings.featureFlags as unknown as Record<string, unknown>,
            analysis_windows: settings.windows as unknown as Record<string, unknown>,
            benchmark_config: settings.benchmarkConfig as unknown as Record<string, unknown>,
            suggestion_templates: settings.suggestionTemplates as unknown as Record<string, unknown>,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'agency_id' }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coaching-insight-config', agencyId] });
    },
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('coaching_insight_settings')
        .upsert(
          {
            agency_id: agencyId!,
            thresholds: DEFAULT_COACHING_INSIGHT_CONFIG.thresholds as unknown as Record<string, unknown>,
            feature_flags: DEFAULT_COACHING_INSIGHT_CONFIG.featureFlags as unknown as Record<string, unknown>,
            analysis_windows: DEFAULT_COACHING_INSIGHT_CONFIG.windows as unknown as Record<string, unknown>,
            benchmark_config: DEFAULT_COACHING_INSIGHT_CONFIG.benchmarkConfig as unknown as Record<string, unknown>,
            suggestion_templates: DEFAULT_COACHING_INSIGHT_CONFIG.suggestionTemplates as unknown as Record<string, unknown>,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'agency_id' }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coaching-insight-config', agencyId] });
    },
  });

  return {
    thresholds: query.data?.thresholds ?? DEFAULT_COACHING_INSIGHT_CONFIG.thresholds,
    featureFlags: query.data?.featureFlags ?? DEFAULT_COACHING_INSIGHT_CONFIG.featureFlags,
    windows: query.data?.windows ?? DEFAULT_COACHING_INSIGHT_CONFIG.windows,
    benchmarkConfig: query.data?.benchmarkConfig ?? DEFAULT_COACHING_INSIGHT_CONFIG.benchmarkConfig,
    suggestionTemplates: query.data?.suggestionTemplates ?? DEFAULT_COACHING_INSIGHT_CONFIG.suggestionTemplates,
    config: query.data ?? DEFAULT_COACHING_INSIGHT_CONFIG,
    isLoading: query.isLoading,
    save: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    reset: resetMutation.mutateAsync,
    isResetting: resetMutation.isPending,
  };
}
