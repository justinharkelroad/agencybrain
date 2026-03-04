import { QueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LqsSalesSyncParams {
  agencyId: string;
  dateStart?: string;
  dateEnd?: string;
  includeUnassigned?: boolean;
  batchSize?: number;
  sessionToken?: string | null;
}

export interface LqsSalesSyncPreviewResponse {
  mode: 'preview';
  agency_id: string;
  date_start: string | null;
  date_end: string | null;
  candidate_count: number;
  excluded_count: number;
  grouped_candidate_count: number;
  to_insert_count: number;
  unassigned_count: number;
  totals: {
    premium_cents: number;
    items: number;
    policies: number;
  };
  product_breakdown: Array<{
    product_type: string;
    rows: number;
    groups: number;
    items: number;
    policies: number;
    premium_cents: number;
  }>;
  notes: string[];
  errors: string[];
}

export interface LqsSalesSyncExecuteResponse {
  mode: 'execute';
  batch_id: string;
  batch_size: number;
  processed_groups: number;
  inserted_sales: number;
  linked_rows: number;
  failed_rows: number;
  skipped_rows: number;
  has_more: boolean;
  next_cursor: string | null;
  status: 'running' | 'completed';
}

export interface LqsSalesSyncUndoResponse {
  mode: 'undo';
  batch_id: string;
  deleted_sales: number;
  cleared_lqs_rows: number;
}

export interface LqsSalesSyncProgress {
  chunk: number;
  batchId: string;
  insertedSales: number;
  linkedRows: number;
  failedRows: number;
  skippedRows: number;
  hasMore: boolean;
}

export interface LqsSalesSyncRunResult {
  batchId: string;
  chunks: number;
  insertedSales: number;
  linkedRows: number;
  failedRows: number;
  skippedRows: number;
}

interface InvokePayload {
  mode: 'preview' | 'execute' | 'undo';
  agency_id: string;
  date_start?: string;
  date_end?: string;
  include_unassigned?: boolean;
  batch_size?: number;
  batch_id?: string;
  cursor?: string;
}

async function invokeSync<T>(payload: InvokePayload, sessionToken?: string | null): Promise<T> {
  const { data, error } = await supabase.functions.invoke('sync_lqs_sales_to_dashboard', {
    headers: sessionToken
      ? {
          'x-staff-session': sessionToken,
        }
      : undefined,
    body: payload,
  });

  if (error) {
    throw error;
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data as T;
}

export async function previewLqsSalesDashboardSync(
  params: LqsSalesSyncParams
): Promise<LqsSalesSyncPreviewResponse> {
  return invokeSync<LqsSalesSyncPreviewResponse>(
    {
      mode: 'preview',
      agency_id: params.agencyId,
      date_start: params.dateStart,
      date_end: params.dateEnd,
      include_unassigned: params.includeUnassigned ?? true,
    },
    params.sessionToken
  );
}

export async function runLqsSalesDashboardSync(
  params: LqsSalesSyncParams & { onProgress?: (progress: LqsSalesSyncProgress) => void }
): Promise<LqsSalesSyncRunResult> {
  const includeUnassigned = params.includeUnassigned ?? true;
  const batchSize = params.batchSize ?? 200;

  let batchId = '';
  let cursor: string | undefined;
  let hasMore = true;
  let chunk = 0;
  let insertedSales = 0;
  let linkedRows = 0;
  let failedRows = 0;
  let skippedRows = 0;

  while (hasMore) {
    const response = await invokeSync<LqsSalesSyncExecuteResponse>(
      {
        mode: 'execute',
        agency_id: params.agencyId,
        date_start: params.dateStart,
        date_end: params.dateEnd,
        include_unassigned: includeUnassigned,
        batch_size: batchSize,
        batch_id: batchId || undefined,
        cursor,
      },
      params.sessionToken
    );

    batchId = response.batch_id;
    cursor = response.next_cursor ?? undefined;
    hasMore = response.has_more;
    chunk += 1;

    insertedSales += response.inserted_sales;
    linkedRows += response.linked_rows;
    failedRows += response.failed_rows;
    skippedRows += response.skipped_rows;

    params.onProgress?.({
      chunk,
      batchId,
      insertedSales,
      linkedRows,
      failedRows,
      skippedRows,
      hasMore,
    });
  }

  return {
    batchId,
    chunks: chunk,
    insertedSales,
    linkedRows,
    failedRows,
    skippedRows,
  };
}

export async function undoLqsSalesDashboardSync(
  agencyId: string,
  batchId: string,
  sessionToken?: string | null
): Promise<LqsSalesSyncUndoResponse> {
  return invokeSync<LqsSalesSyncUndoResponse>(
    {
      mode: 'undo',
      agency_id: agencyId,
      batch_id: batchId,
    },
    sessionToken
  );
}

export async function invalidateLqsSalesSyncQueries(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['dashboard-daily'] }),
    queryClient.invalidateQueries({ queryKey: ['sales-leaderboard'] }),
    queryClient.invalidateQueries({ queryKey: ['sales-trends'] }),
    queryClient.invalidateQueries({ queryKey: ['sales-month-summary'] }),
    queryClient.invalidateQueries({ queryKey: ['promo-goals'] }),
    queryClient.invalidateQueries({ queryKey: ['staff-commission'] }),
    queryClient.invalidateQueries({ queryKey: ['lqs-roi'] }),
    queryClient.invalidateQueries({ queryKey: ['lqs-roi-households'] }),
    queryClient.invalidateQueries({ queryKey: ['lqs-roi-households-pipeline'] }),
    queryClient.invalidateQueries({ queryKey: ['lqs-roi-sales-activity'] }),
    queryClient.invalidateQueries({ queryKey: ['lqs-data'] }),
    queryClient.invalidateQueries({ queryKey: ['staff-lqs-data'] }),
  ]);
}
