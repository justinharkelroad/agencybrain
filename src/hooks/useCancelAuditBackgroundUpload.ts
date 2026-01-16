import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getStaffSessionToken, callCancelAuditApi } from '@/lib/cancel-audit-api';
import type { ParsedCancelAuditRecord } from '@/lib/cancel-audit-parser';
import type { ReportType } from '@/types/cancel-audit';

interface CancelAuditUploadContext {
  agencyId: string;
  userId: string | null;
  staffMemberId: string | null;
  displayName: string;
}

const BATCH_SIZE = 50;

export function useCancelAuditBackgroundUpload() {
  const queryClient = useQueryClient();

  const startBackgroundUpload = async (
    records: ParsedCancelAuditRecord[],
    reportType: ReportType,
    filename: string,
    context: CancelAuditUploadContext
  ) => {
    const staffToken = getStaffSessionToken();
    const reportLabel = reportType === 'cancellation' ? 'Cancellation Audit' : 'Pending Cancel';

    // Show immediate feedback
    toast.info(`Processing ${records.length} ${reportLabel} records...`, {
      description: "You can navigate away. We'll notify you when complete.",
    });

    // Process in background (don't await)
    if (staffToken) {
      processStaffUpload(records, reportType, filename, context, staffToken, queryClient);
    } else {
      processInBackground(records, reportType, filename, context, queryClient);
    }
  };

  return { startBackgroundUpload };
}

async function processStaffUpload(
  records: ParsedCancelAuditRecord[],
  reportType: ReportType,
  filename: string,
  context: CancelAuditUploadContext,
  staffToken: string,
  queryClient: ReturnType<typeof useQueryClient>
) {
  try {
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

    // Invalidate queries
    invalidateCancelAuditQueries(queryClient);

    const reportLabel = reportType === 'cancellation' ? 'Cancellation Audit' : 'Pending Cancel';
    
    if (result.success) {
      toast.success(`${reportLabel} Upload Complete!`, {
        description: `${result.recordsProcessed} records (${result.recordsCreated} new, ${result.recordsUpdated} updated)`,
      });
    } else {
      toast.error(`${reportLabel} Upload Failed`, {
        description: result.errors?.[0] || 'An error occurred during processing',
      });
    }
  } catch (error: any) {
    console.error('Staff upload error:', error);
    toast.error('Cancel Audit Upload Failed', {
      description: error.message || 'An error occurred during processing',
    });
  }
}

async function processInBackground(
  records: ParsedCancelAuditRecord[],
  reportType: ReportType,
  filename: string,
  context: CancelAuditUploadContext,
  queryClient: ReturnType<typeof useQueryClient>
) {
  const { agencyId, userId, staffMemberId, displayName } = context;

  try {
    let recordsCreated = 0;
    let recordsUpdated = 0;
    const errors: string[] = [];

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

    // 2. Deactivate all existing records of this report type
    await supabase
      .from('cancel_audit_records')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('agency_id', agencyId)
      .eq('report_type', reportType)
      .eq('is_active', true);

    // 3. Process records in batches using RPC function
    const totalBatches = Math.ceil(records.length / BATCH_SIZE);

    for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
      const start = batchIdx * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, records.length);
      const batch = records.slice(start, end);

      for (const record of batch) {
        const { data, error: rpcError } = await supabase.rpc('upsert_cancel_audit_record', {
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
          p_cancel_date: record.cancel_date,
          p_renewal_effective_date: record.renewal_effective_date,
          p_pending_cancel_date: record.pending_cancel_date,
          p_last_upload_id: uploadId,
        });

        if (rpcError) {
          errors.push(`Policy ${record.policy_number}: ${rpcError.message}`);
        } else if (data && data[0]) {
          if (data[0].was_created) {
            recordsCreated++;
          } else {
            recordsUpdated++;
          }
        }
      }
    }

    // 4. Update upload record with final counts
    await supabase
      .from('cancel_audit_uploads')
      .update({
        records_created: recordsCreated,
        records_updated: recordsUpdated,
      })
      .eq('id', uploadId);

    // Invalidate queries
    invalidateCancelAuditQueries(queryClient);

    const reportLabel = reportType === 'cancellation' ? 'Cancellation Audit' : 'Pending Cancel';
    const totalProcessed = recordsCreated + recordsUpdated;

    if (errors.length === 0) {
      toast.success(`${reportLabel} Upload Complete!`, {
        description: `${totalProcessed} records (${recordsCreated} new, ${recordsUpdated} updated)`,
      });
    } else {
      toast.warning('Upload completed with issues', {
        description: `${totalProcessed} succeeded, ${errors.length} failed`,
      });
    }
  } catch (error: any) {
    console.error('Background processing error:', error);
    toast.error('Cancel Audit Upload Failed', {
      description: error.message || 'An error occurred during processing',
    });
  }
}

function invalidateCancelAuditQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['cancel-audit-records'] });
  queryClient.invalidateQueries({ queryKey: ['cancel-audit-stats'] });
  queryClient.invalidateQueries({ queryKey: ['cancel-audit-uploads'] });
}
