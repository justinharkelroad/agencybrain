import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getStaffSessionToken } from '@/lib/cancel-audit-api';
import type { ParsedRenewalRecord, RenewalUploadContext } from '@/types/renewal';
import { getRenewalDateRange } from '@/lib/renewalParser';

export function useRenewalUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const uploadRecords = async (records: ParsedRenewalRecord[], filename: string, context: RenewalUploadContext) => {
    const { agencyId, userId, displayName } = context;
    if (getStaffSessionToken()) throw new Error('Staff portal upload requires edge function (Phase 3)');

    setIsUploading(true); setProgress(0); setError(null);
    try {
      const dateRange = getRenewalDateRange(records);
      const { data: upload, error: uploadError } = await supabase.from('renewal_uploads')
        .insert({ agency_id: agencyId, filename, uploaded_by: userId, uploaded_by_display_name: displayName,
          record_count: records.length, date_range_start: dateRange?.start, date_range_end: dateRange?.end })
        .select().single();
      if (uploadError) throw uploadError;

      let newCount = 0, updatedCount = 0;
      for (let i = 0; i < records.length; i++) {
        const r = records[i];
        const { data: result } = await supabase.rpc('upsert_renewal_record', {
          p_agency_id: agencyId, p_upload_id: upload.id, p_policy_number: r.policyNumber,
          p_renewal_effective_date: r.renewalEffectiveDate, p_first_name: r.firstName,
          p_last_name: r.lastName, p_email: r.email, p_phone: r.phone, p_phone_alt: r.phoneAlt,
          p_product_name: r.productName, p_agent_number: r.agentNumber, p_renewal_status: r.renewalStatus,
          p_account_type: r.accountType, p_premium_old: r.premiumOld, p_premium_new: r.premiumNew,
          p_premium_change_dollars: r.premiumChangeDollars, p_premium_change_percent: r.premiumChangePercent,
          p_amount_due: r.amountDue, p_easy_pay: r.easyPay, p_multi_line_indicator: r.multiLineIndicator,
          p_item_count: r.itemCount, p_years_prior_insurance: r.yearsPriorInsurance,
          p_household_key: r.householdKey, p_uploaded_by: userId, p_uploaded_by_display_name: displayName,
        });
        if (result?.action === 'inserted') newCount++; else if (result?.action === 'updated') updatedCount++;
        setProgress(Math.round(((i + 1) / records.length) * 100));
      }
      return { uploadId: upload.id, totalRecords: records.length, newRecords: newCount, updatedRecords: updatedCount };
    } catch (err) { const msg = err instanceof Error ? err.message : 'Upload failed'; setError(msg); throw err; }
    finally { setIsUploading(false); }
  };

  const resetUpload = () => { setIsUploading(false); setProgress(0); setError(null); };
  return { uploadRecords, isUploading, progress, error, resetUpload };
}
