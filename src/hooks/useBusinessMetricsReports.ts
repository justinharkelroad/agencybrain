import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import type {
  BusinessMetricsReport,
  CreateBusinessMetricsReportInput,
} from '@/lib/growth-center/types';

const GROWTH_REPORTS_BUCKET = 'business-metrics';

type FunctionErrorContext = {
  json?: () => Promise<{ error?: string }>;
};

function getFunctionErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function monthToDate(month: string): string {
  return `${month}-01`;
}

function centsFromDollars(value?: number | null): number | null {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return null;
  }
  return Math.round(value * 100);
}

type SupabaseLike = typeof supabase;

async function fetchReports(agencyId: string, carrierSchemaId?: string | null): Promise<BusinessMetricsReport[]> {
  let query = supabase
    .from('business_metrics_reports' as never)
    .select('*')
    .eq('agency_id', agencyId)
    .order('report_month', { ascending: false });

  if (carrierSchemaId) {
    query = query.eq('carrier_schema_id', carrierSchemaId);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return (data ?? []) as BusinessMetricsReport[];
}

export async function createBusinessMetricsReport(params: {
  agencyId: string;
  userId: string;
  input: CreateBusinessMetricsReportInput;
  supabaseClient?: SupabaseLike;
}): Promise<BusinessMetricsReport> {
  const { agencyId, userId, input } = params;
  const supabaseClient = params.supabaseClient ?? supabase;

  if (!input.file.name.toLowerCase().endsWith('.xlsx')) {
    throw new Error('Only .xlsx files are supported.');
  }

  const reportMonthDate = monthToDate(input.reportMonth);
  const fileExt = input.file.name.split('.').pop() ?? 'xlsx';
  const timestamp = Date.now();
  const storagePath = `${agencyId}/${input.reportMonth}/${timestamp}.${fileExt}`;

  const { error: uploadError } = await supabaseClient.storage
    .from(GROWTH_REPORTS_BUCKET)
    .upload(storagePath, input.file, { upsert: true });

  if (uploadError) {
    throw uploadError;
  }

  const { data: existingReports, error: existingReportError } = await supabaseClient
    .from('business_metrics_reports' as never)
    .select('id')
    .eq('agency_id', agencyId)
    .eq('report_month', reportMonthDate)
    .eq('carrier_schema_id', input.carrierSchemaId)
    .order('updated_at', { ascending: false })
    .limit(1);

  if (existingReportError) {
    throw existingReportError;
  }
  const existingReport = existingReports?.[0] as { id: string } | undefined;

  let reportRow: BusinessMetricsReport | null = null;

  if (existingReport?.id) {
    const { data: updatedRow, error: updateError } = await supabaseClient
      .from('business_metrics_reports' as never)
      .update({
        user_id: userId,
        carrier_schema_id: input.carrierSchemaId,
        report_month: reportMonthDate,
        original_filename: input.file.name,
        file_path: storagePath,
        bonus_projection_cents: centsFromDollars(input.bonusProjectionDollars),
        parse_status: 'pending',
        parse_error: null,
        parsed_data: null,
        agent_code: null,
        agent_name: null,
      })
      .eq('id', existingReport.id)
      .select('*')
      .single();

    if (updateError) {
      throw updateError;
    }

    // Remove any prior flattened snapshot rows for this report immediately.
    // If parsing fails later, stale metrics should not remain visible.
    const { error: clearSnapshotsError } = await supabaseClient
      .from('business_metrics_snapshots' as never)
      .delete()
      .eq('report_id', existingReport.id);
    if (clearSnapshotsError) {
      throw clearSnapshotsError;
    }

    reportRow = updatedRow as BusinessMetricsReport;
  } else {
    const { data: insertedRow, error: insertError } = await supabaseClient
      .from('business_metrics_reports' as never)
      .insert({
        agency_id: agencyId,
        user_id: userId,
        carrier_schema_id: input.carrierSchemaId,
        report_month: reportMonthDate,
        original_filename: input.file.name,
        file_path: storagePath,
        bonus_projection_cents: centsFromDollars(input.bonusProjectionDollars),
        parse_status: 'pending',
      })
      .select('*')
      .single();

    if (insertError) {
      throw insertError;
    }

    reportRow = insertedRow as BusinessMetricsReport;
  }

  const { error: parseError } = await supabaseClient.functions.invoke('parse_business_metrics', {
    body: {
      report_id: reportRow.id,
      carrier_schema_key: input.carrierSchemaKey,
    },
  });

  if (parseError) {
    let parsedMessage: string | null = null;
    const context =
      typeof parseError === 'object' && parseError !== null && 'context' in parseError
        ? (parseError as { context?: FunctionErrorContext }).context
        : undefined;
    if (context?.json) {
      const errorBody = await context.json().catch(() => null);
      if (errorBody?.error) {
        parsedMessage = errorBody.error;
      }
    }
    const fallbackMessage = getFunctionErrorMessage(parseError);
    const finalMessage = parsedMessage ?? fallbackMessage;

    // If invocation failed before the function could persist parse_status,
    // mark the report as errored here to avoid stale "pending" records.
    await supabaseClient
      .from('business_metrics_reports' as never)
      .update({
        parse_status: 'error',
        parse_error: finalMessage.slice(0, 1000),
      })
      .eq('id', reportRow.id);

    throw new Error(finalMessage);
  }

  return reportRow as BusinessMetricsReport;
}

export function useBusinessMetricsReports(carrierSchemaId?: string | null) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { agencyId } = useUserPermissions();

  const reportsQuery = useQuery({
    queryKey: ['growth-center', 'reports', agencyId, carrierSchemaId ?? 'all'],
    queryFn: () => fetchReports(agencyId as string, carrierSchemaId),
    enabled: Boolean(agencyId),
  });

  const createReportMutation = useMutation({
    mutationFn: async (input: CreateBusinessMetricsReportInput) => {
      if (!agencyId || !user?.id) {
        throw new Error('Missing agency or user context.');
      }
      return createBusinessMetricsReport({
        agencyId,
        userId: user.id,
        input,
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['growth-center', 'reports'] });
      queryClient.invalidateQueries({ queryKey: ['growth-center', 'snapshots'] });
    },
  });

  const latestReport = useMemo(
    () => reportsQuery.data?.[0] ?? null,
    [reportsQuery.data]
  );

  return {
    ...reportsQuery,
    reports: reportsQuery.data ?? [],
    latestReport,
    createReport: createReportMutation.mutateAsync,
    isCreatingReport: createReportMutation.isPending,
    createReportError: createReportMutation.error,
  };
}
