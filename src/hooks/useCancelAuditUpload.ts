import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getStaffSessionToken, callCancelAuditApi } from '@/lib/cancel-audit-api';
import type { ParsedCancelAuditRecord } from '@/lib/cancel-audit-parser';
import type { ReportType } from '@/types/cancel-audit';

interface UploadContext {
  agencyId: string;
  userId: string | null;
  staffMemberId: string | null;
  displayName: string;
}

interface UploadResult {
  success: boolean;
  uploadId: string | null;
  recordsProcessed: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsDeactivated: number;
  errors: string[];
}

const BATCH_SIZE = 50;

// Deactivate existing records of the same report type before uploading new ones
const deactivateOldRecords = async (agencyId: string, reportType: ReportType): Promise<number> => {
  const { data, error } = await supabase
    .from('cancel_audit_records')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('agency_id', agencyId)
    .eq('report_type', reportType)
    .eq('is_active', true)
    .select('id');

  if (error) {
    console.error('Failed to deactivate old records:', error);
    throw error;
  }

  return data?.length || 0;
};

export function useCancelAuditUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const uploadRecords = async (
    records: ParsedCancelAuditRecord[],
    reportType: ReportType,
    fileName: string | null,
    context: UploadContext
  ): Promise<UploadResult> => {
    setIsUploading(true);
    setProgress(0);
    setError(null);

    try {
      // Check if this is a staff user - if so, use the edge function
      const staffToken = getStaffSessionToken();
      
      if (staffToken) {
        console.log('[useCancelAuditUpload] Staff user detected, using edge function');
        
        // Staff user: route through edge function
        const result = await callCancelAuditApi({
          operation: 'upload_records',
          params: {
            records,
            reportType,
            fileName,
            displayName: context.displayName,
          },
          sessionToken: staffToken,
        });

        setProgress(100);
        return result as UploadResult;
      }

      // Regular user: use direct Supabase calls
      console.log('[useCancelAuditUpload] Regular user, using direct Supabase calls');
      
      const errors: string[] = [];
      let recordsCreated = 0;
      let recordsUpdated = 0;
      let recordsDeactivated = 0;

      // 1. Create upload record
      const { data: uploadData, error: uploadError } = await supabase
        .from('cancel_audit_uploads')
        .insert({
          agency_id: context.agencyId,
          uploaded_by_user_id: context.userId,
          uploaded_by_staff_id: context.staffMemberId,
          uploaded_by_name: context.displayName,
          report_type: reportType,
          file_name: fileName,
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

      // 2. DEACTIVATE all existing records of this report type
      recordsDeactivated = await deactivateOldRecords(context.agencyId, reportType);

      // 3. Process records in batches using RPC function
      const totalBatches = Math.ceil(records.length / BATCH_SIZE);
      
      for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
        const start = batchIdx * BATCH_SIZE;
        const end = Math.min(start + BATCH_SIZE, records.length);
        const batch = records.slice(start, end);

        for (const record of batch) {
          const { data, error: rpcError } = await supabase.rpc('upsert_cancel_audit_record', {
            p_agency_id: context.agencyId,
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

        setProgress(Math.round(((batchIdx + 1) / totalBatches) * 100));
      }

      // 4. Update upload record with final counts
      const { error: updateError } = await supabase
        .from('cancel_audit_uploads')
        .update({
          records_created: recordsCreated,
          records_updated: recordsUpdated,
        })
        .eq('id', uploadId);

      if (updateError) {
        console.error('Failed to update upload record counts:', updateError);
      }

      return {
        success: errors.length === 0,
        uploadId,
        recordsProcessed: records.length,
        recordsCreated,
        recordsUpdated,
        recordsDeactivated,
        errors,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      return {
        success: false,
        uploadId: null,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        recordsDeactivated: 0,
        errors: [errorMessage],
      };
    } finally {
      setIsUploading(false);
    }
  };

  return {
    uploadRecords,
    isUploading,
    progress,
    error,
  };
}
