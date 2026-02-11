import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import type { GICAnalysis, RunGICAnalysisInput } from '@/lib/growth-center/types';

type FunctionErrorContext = {
  json?: () => Promise<{ error?: string; detail?: string }>;
};

interface AnalysisResponse {
  success: boolean;
  analysis_id: string | null;
  analysis_result: string;
  model_used: string;
  reports_analyzed?: number;
  included_lqs_data?: boolean;
  included_scorecard_data?: boolean;
  is_follow_up: boolean;
}

interface FollowUpRequest {
  analysisId: string;
  message: string;
  reportIds: string[];
}

async function fetchAnalyses(agencyId: string): Promise<GICAnalysis[]> {
  const { data, error } = await supabase
    .from('gic_analyses' as never)
    .select('*')
    .eq('agency_id', agencyId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    throw error;
  }

  return (data ?? []) as GICAnalysis[];
}

async function extractFunctionError(error: unknown, fallback: string): Promise<Error> {
  const context =
    typeof error === 'object' && error !== null && 'context' in error
      ? (error as { context?: FunctionErrorContext }).context
      : undefined;

  if (context?.json) {
    const body = await context.json().catch(() => null);
    if (body?.error || body?.detail) {
      return new Error(body.error ?? body.detail ?? fallback);
    }
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error(fallback);
}

export function useGICAnalysis() {
  const queryClient = useQueryClient();
  const { agencyId } = useUserPermissions();

  const analysesQuery = useQuery({
    queryKey: ['growth-center', 'analyses', agencyId],
    queryFn: () => fetchAnalyses(agencyId as string),
    enabled: Boolean(agencyId),
  });

  const runAnalysisMutation = useMutation({
    mutationFn: async (input: RunGICAnalysisInput): Promise<AnalysisResponse> => {
      if (!agencyId) {
        throw new Error('Agency is required to run analysis.');
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const { data, error } = await supabase.functions.invoke('analyze_growth_metrics', {
        body: {
          agency_id: agencyId,
          report_ids: input.reportIds,
          analysis_type: input.analysisType,
          include_lqs_data: input.includeLqsData,
          include_scorecard_data: input.includeScorecardData,
          custom_question: input.customQuestion ?? null,
        },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (error) {
        throw await extractFunctionError(error, 'Analysis failed');
      }

      return data as AnalysisResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['growth-center', 'analyses'] });
    },
  });

  const followUpMutation = useMutation({
    mutationFn: async (request: FollowUpRequest): Promise<AnalysisResponse> => {
      if (!agencyId) {
        throw new Error('Agency is required to send follow-up questions.');
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const { data, error } = await supabase.functions.invoke('analyze_growth_metrics', {
        body: {
          agency_id: agencyId,
          report_ids: request.reportIds,
          follow_up: {
            analysis_id: request.analysisId,
            message: request.message,
          },
        },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (error) {
        throw await extractFunctionError(error, 'Follow-up failed');
      }

      return data as AnalysisResponse;
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
    sendFollowUp: followUpMutation.mutateAsync,
    isFollowingUp: followUpMutation.isPending,
    followUpError: followUpMutation.error,
    lastFollowUpResult: followUpMutation.data,
  };
}
