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
      
      // Create upload record
      const { data: upload, error: uploadError } = await supabase.from('renewal_uploads')
        .insert({ 
          agency_id: agencyId, 
          filename, 
          uploaded_by: userId, 
          uploaded_by_display_name: displayName,
          record_count: records.length, 
          date_range_start: dateRange?.start, 
          date_range_end: dateRange?.end 
        })
        .select()
        .single();
      if (uploadError) throw uploadError;

      let newCount = 0, updatedCount = 0;
      
      for (let i = 0; i < records.length; i++) {
        const r = records[i];
        
        // Check if record exists
        const { data: existing } = await supabase
          .from('renewal_records')
          .select('id')
          .eq('agency_id', agencyId)
          .eq('policy_number', r.policyNumber)
          .eq('renewal_effective_date', r.renewalEffectiveDate)
          .eq('is_active', true)
          .maybeSingle();
        
        if (existing) {
          // Update existing record (preserve workflow fields)
          const { error: updateError } = await supabase
            .from('renewal_records')
            .update({
              first_name: r.firstName,
              last_name: r.lastName,
              email: r.email,
              phone: r.phone,
              phone_alt: r.phoneAlt,
              product_name: r.productName,
              agent_number: r.agentNumber,
              renewal_status: r.renewalStatus,
              account_type: r.accountType,
              premium_old: r.premiumOld,
              premium_new: r.premiumNew,
              premium_change_dollars: r.premiumChangeDollars,
              premium_change_percent: r.premiumChangePercent,
              amount_due: r.amountDue,
              easy_pay: r.easyPay,
              multi_line_indicator: r.multiLineIndicator,
              item_count: r.itemCount,
              years_prior_insurance: r.yearsPriorInsurance,
              household_key: r.householdKey,
              last_upload_id: upload.id,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);
          
          if (!updateError) updatedCount++;
        } else {
          // Insert new record
          const { error: insertError } = await supabase
            .from('renewal_records')
            .insert({
              agency_id: agencyId,
              upload_id: upload.id,
              last_upload_id: upload.id,
              policy_number: r.policyNumber,
              renewal_effective_date: r.renewalEffectiveDate,
              first_name: r.firstName,
              last_name: r.lastName,
              email: r.email,
              phone: r.phone,
              phone_alt: r.phoneAlt,
              product_name: r.productName,
              agent_number: r.agentNumber,
              renewal_status: r.renewalStatus,
              account_type: r.accountType,
              premium_old: r.premiumOld,
              premium_new: r.premiumNew,
              premium_change_dollars: r.premiumChangeDollars,
              premium_change_percent: r.premiumChangePercent,
              amount_due: r.amountDue,
              easy_pay: r.easyPay,
              multi_line_indicator: r.multiLineIndicator,
              item_count: r.itemCount,
              years_prior_insurance: r.yearsPriorInsurance,
              household_key: r.householdKey,
              uploaded_by: userId,
              uploaded_by_display_name: displayName,
              current_status: 'uncontacted',
              is_active: true,
            });
          
          if (!insertError) newCount++;
        }
        
        setProgress(Math.round(((i + 1) / records.length) * 100));
      }
      
      return { uploadId: upload.id, totalRecords: records.length, newRecords: newCount, updatedRecords: updatedCount };
    } catch (err) { 
      const msg = err instanceof Error ? err.message : 'Upload failed'; 
      setError(msg); 
      throw err; 
    } finally { 
      setIsUploading(false); 
    }
  };

  const resetUpload = () => { setIsUploading(false); setProgress(0); setError(null); };
  return { uploadRecords, isUploading, progress, error, resetUpload };
}
