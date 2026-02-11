import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import type { GICAnalysis, RunGICAnalysisInput } from '@/lib/growth-center/types';

type FunctionErrorContext = {
  json?: () => Promise<{ error?: string }>;
};

async function fetchAnalyses(agencyId: string): Promise<GICAnalysis[]> {
  const { data, error } = await supabase
    .from('gic_analyses' as never)
    .select('*')
    .eq('agency_id', agencyId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as GICAnalysis[];
}

export function useGICAnalysis() {
  const queryClient = useQueryClient();
  const { agencyId } = useUserPermissions();
  const { user } = useAuth();

  const analysesQuery = useQuery({
    queryKey: ['growth-center', 'analyses', agencyId],
    queryFn: () => fetchAnalyses(agencyId as string),
    enabled: Boolean(agencyId),
  });

  const runAnalysisMutation = useMutation({
    mutationFn: async (input: RunGICAnalysisInput) => {
      if (!agencyId) {
        throw new Error('Agency is required to run analysis.');
      }

      const { data, error } = await supabase.functions.invoke('analyze_growth_metrics', {
        body: {
          agency_id: agencyId,
          report_ids: input.reportIds,
          analysis_type: input.analysisType,
          include_lqs_data: input.includeLqsData,
          include_scorecard_data: input.includeScorecardData,
          custom_question: input.customQuestion,
          created_by: user?.id ?? null,
        },
      });

      if (error) {
        const context =
          typeof error === 'object' && error !== null && 'context' in error
            ? (error as { context?: FunctionErrorContext }).context
            : undefined;
        if (context?.json) {
          const errorBody = await context.json().catch(() => null);
          if (errorBody?.error) {
            throw new Error(errorBody.error);
          }
        }
        throw error;
      }

      return data as { analysis?: GICAnalysis };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['growth-center', 'analyses'] });
    },
  });

  return {
    ...analysesQuery,
    analyses: analysesQuery.data ?? [],
    runAnalysis: runAnalysisMutation.mutateAsync,
    isRunningAnalysis: runAnalysisMutation.isPending,
    runAnalysisError: runAnalysisMutation.error,
  };
}
