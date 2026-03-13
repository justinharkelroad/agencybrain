import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getStaffSessionToken, callCancelAuditApi } from '@/lib/cancel-audit-api';
import type { ParsedCancelAuditRecord } from '@/lib/cancel-audit-parser';
import type { ReportType } from '@/types/cancel-audit';

const BATCH_SIZE = 50;

export interface UploadProgress {
  isProcessing: boolean;
  processed: number;
  total: number;
  phase: 'idle' | 'uploading' | 'finalizing' | 'complete' | 'error';
  result: {
    recordsCreated: number;
    recordsUpdated: number;
    recordsDropped: number;
    errors: number;
  } | null;
  errorMessage: string | null;
}

interface CancelAuditUploadContext {
  agencyId: string;
  userId: string | null;
  staffMemberId: string | null;
  displayName: string;
}

const INITIAL_PROGRESS: UploadProgress = {
  isProcessing: false,
  processed: 0,
  total: 0,
  phase: 'idle',
  result: null,
  errorMessage: null,
};

export function useCancelAuditBackgroundUpload() {
  const queryClient = useQueryClient();
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>(INITIAL_PROGRESS);

  const startUpload = async (
    records: ParsedCancelAuditRecord[],
    reportType: ReportType,
    filename: string,
    context: CancelAuditUploadContext
  ) => {
    const staffToken = getStaffSessionToken();

    setUploadProgress({
      isProcessing: true,
      processed: 0,
      total: records.length,
      phase: 'uploading',
      result: null,
      errorMessage: null,
    });

    try {
      if (staffToken) {
        // Staff: edge function handles everything server-side (no live progress)
        const result = await callCancelAuditApi({
          operation: 'upload_records',
          params: {
            records,
            reportType,
            fileName: filename,
            displayName: context.displayName,
          },
          sessionToken: staffToken,
        });

        invalidateCancelAuditQueries(queryClient);

        setUploadProgress({
          isProcessing: false,
          processed: records.length,
          total: records.length,
          phase: 'complete',
          result: {
            recordsCreated: result.recordsCreated || 0,
            recordsUpdated: result.recordsUpdated || 0,
            recordsDropped: result.recordsDropped || 0,
            errors: result.errors?.length || 0,
          },
          errorMessage: null,
        });
      } else {
        // Regular users: client-side parallel processing with progress
        await processWithProgress(
          records, reportType, filename, context,
          setUploadProgress, queryClient
        );
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      setUploadProgress(prev => ({
        ...prev,
        isProcessing: false,
        phase: 'error',
        errorMessage: error.message || 'Upload failed',
      }));
    }
  };

  const resetProgress = () => {
    setUploadProgress(INITIAL_PROGRESS);
  };

  return { startUpload, uploadProgress, resetProgress };
}

async function processWithProgress(
  records: ParsedCancelAuditRecord[],
  reportType: ReportType,
  filename: string,
  context: CancelAuditUploadContext,
  setProgress: React.Dispatch<React.SetStateAction<UploadProgress>>,
  queryClient: ReturnType<typeof useQueryClient>
) {
  const { agencyId, userId, staffMemberId, displayName } = context;

  // Guard against browser close/refresh during processing
  const beforeUnloadHandler = (e: BeforeUnloadEvent) => {
    e.preventDefault();
    e.returnValue = 'Upload is still processing. Leaving will stop the upload.';
    return e.returnValue;
  };
  window.addEventListener('beforeunload', beforeUnloadHandler);

  try {
  // 1. Create upload record
  const { data: uploadData, error: uploadError } = await supabase
    .from('cancel_audit_uploads')
    .insert({
      agency_id: agencyId,
      uploaded_by_user_id: userId,
      uploaded_by_staff_id: staffMemberId,
      uploaded_by_name: displayName,
      report_type: reportType,
      file_name: filename,
      records_processed: records.length,
      records_created: 0,
      records_updated: 0,
    })
    .select('id')
    .single();

  if (uploadError) {
    throw new Error(`Failed to create upload record: ${uploadError.message}`);
  }

  const uploadId = uploadData.id;

  // 2. Process records in parallel batches (like renewals).
  //    DEACTIVATION HAPPENS AFTER — prevents the partial-processing data loss
  //    that occurs when deactivation commits upfront but processing is interrupted.
  let recordsCreated = 0;
  let recordsUpdated = 0;
  let errorCount = 0;
  let processed = 0;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, Math.min(i + BATCH_SIZE, records.length));

    const batchResults = await Promise.allSettled(
      batch.map(record =>
        supabase.rpc('upsert_cancel_audit_record', {
          p_agency_id: agencyId,
          p_policy_number: record.policy_number,
          p_household_key: record.household_key,
          p_insured_first_name: record.insured_first_name,
          p_insured_last_name: record.insured_last_name,
          p_insured_email: record.insured_email,
          p_insured_phone: record.insured_phone,
          p_insured_phone_alt: record.insured_phone_alt,
          p_agent_number: record.agent_number,
          p_product_name: record.product_name,
          p_premium_cents: record.premium_cents,
          p_no_of_items: record.no_of_items,
          p_account_type: record.account_type,
          p_report_type: record.report_type,
          p_amount_due_cents: record.amount_due_cents,
          p_cancel_status: record.cancel_status,
          p_cancel_date: record.cancel_date,
          p_renewal_effective_date: record.renewal_effective_date,
          p_pending_cancel_date: record.pending_cancel_date,
          p_last_upload_id: uploadId,
          p_original_year: record.original_year,
          p_city: record.city || null,
          p_state: record.state || null,
          p_zip_code: record.zip_code || null,
          p_company_code: record.company_code || null,
          p_premium_old_cents: record.premium_old_cents || 0,
        })
      )
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        const { data, error } = result.value;
        if (error) {
          errorCount++;
          console.error('Record upsert error:', error.message);
        } else if (data?.[0]) {
          if (data[0].was_created) recordsCreated++;
          else recordsUpdated++;
        }
      } else {
        errorCount++;
        console.error('Record processing error:', result.reason);
      }
    }

    processed += batch.length;
    setProgress(prev => ({ ...prev, processed }));
  }

  // 3. DEACTIVATE AFTER processing — only records of this report_type that
  //    were NOT touched by this upload (identified by last_upload_id).
  //    This is the key fix: if processing is interrupted, no records are
  //    deactivated because this step never runs. Worst case = "too many"
  //    active records, never "too few".
  setProgress(prev => ({ ...prev, phase: 'finalizing' }));

  const { data: deactivated } = await supabase
    .from('cancel_audit_records')
    .update({
      is_active: false,
      dropped_from_report_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('agency_id', agencyId)
    .eq('report_type', reportType)
    .eq('is_active', true)
    .neq('last_upload_id', uploadId)
    .select('id');

  const recordsDropped = deactivated?.length || 0;

  // 4. Update upload record with final counts
  await supabase
    .from('cancel_audit_uploads')
    .update({
      records_created: recordsCreated,
      records_updated: recordsUpdated,
    })
    .eq('id', uploadId);

  // 5. Invalidate queries
  invalidateCancelAuditQueries(queryClient);

  // 6. Set final state
  setProgress({
    isProcessing: false,
    processed: records.length,
    total: records.length,
    phase: 'complete',
    result: { recordsCreated, recordsUpdated, recordsDropped, errors: errorCount },
    errorMessage: null,
  });
  } finally {
    window.removeEventListener('beforeunload', beforeUnloadHandler);
  }
}

function invalidateCancelAuditQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['cancel-audit-records'] });
  queryClient.invalidateQueries({ queryKey: ['cancel-audit-stats'] });
  queryClient.invalidateQueries({ queryKey: ['cancel-audit-uploads'] });
  queryClient.invalidateQueries({ queryKey: ['cancel-audit-latest-uploads'] });
  queryClient.invalidateQueries({ queryKey: ['cancel-audit-counts'] });
}
