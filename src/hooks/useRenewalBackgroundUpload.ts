import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { getStaffSessionToken } from '@/lib/cancel-audit-api';
import type { ParsedRenewalRecord, RenewalUploadContext } from '@/types/renewal';
import { getRenewalDateRange } from '@/lib/renewalParser';

const BATCH_SIZE = 50;

export function useRenewalBackgroundUpload() {
  const queryClient = useQueryClient();

  const startBackgroundUpload = async (
    records: ParsedRenewalRecord[], 
    filename: string, 
    context: RenewalUploadContext
  ) => {
    const { agencyId, userId, displayName } = context;
    const staffToken = getStaffSessionToken();
    
    // Show immediate feedback
    toast({
      title: `Processing ${records.length} renewal records...`,
      description: "You can navigate away. We'll notify you when complete.",
    });

    if (staffToken) {
      // Staff users use edge function
      processStaffUpload(records, filename, staffToken, queryClient);
    } else {
      // Regular users use direct database access
      processInBackground(records, filename, agencyId, userId!, displayName, queryClient);
    }
  };

  return { startBackgroundUpload };
}

async function processStaffUpload(
  records: ParsedRenewalRecord[],
  filename: string,
  staffToken: string,
  queryClient: ReturnType<typeof useQueryClient>
) {
  try {
    const { data, error } = await supabase.functions.invoke('upload_staff_renewals', {
      headers: { 'x-staff-session': staffToken },
      body: { records, filename },
    });

    if (error) {
      console.error('Edge function error:', error);
      throw new Error(error.message || 'Edge function call failed');
    }

    if (!data?.success) {
      throw new Error(data?.error || 'Upload failed');
    }

    // Invalidate queries so data refreshes
    queryClient.invalidateQueries({ queryKey: ['renewal-records'] });
    queryClient.invalidateQueries({ queryKey: ['renewal-stats'] });
    queryClient.invalidateQueries({ queryKey: ['renewal-uploads'] });
    queryClient.invalidateQueries({ queryKey: ['renewal-activities'] });

    const totalProcessed = data.newCount + data.updatedCount;
    if (data.errorCount === 0) {
      toast({
        title: 'Renewal Upload Complete!',
        description: `${totalProcessed} records processed (${data.newCount} new, ${data.updatedCount} updated) from ${filename}`,
      });
    } else {
      toast({
        title: 'Upload completed with issues',
        description: `${totalProcessed} succeeded, ${data.errorCount} failed from ${filename}`,
        variant: 'destructive',
      });
    }
  } catch (error: any) {
    console.error('Staff upload error:', error);
    toast({
      title: 'Renewal Upload Failed',
      description: error.message || 'An error occurred during processing',
      variant: 'destructive',
    });
  }
}

async function processInBackground(
  records: ParsedRenewalRecord[],
  filename: string,
  agencyId: string,
  userId: string,
  displayName: string,
  queryClient: ReturnType<typeof useQueryClient>
) {
  try {
    const dateRange = getRenewalDateRange(records);
    
    // Create upload record first
    const { data: upload, error: uploadError } = await supabase
      .from('renewal_uploads')
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

    let newCount = 0;
    let updatedCount = 0;
    let errorCount = 0;

    // Process in batches
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, Math.min(i + BATCH_SIZE, records.length));
      
      // Process each record in the batch
      const batchResults = await Promise.allSettled(
        batch.map(async (r) => {
          // Check if record exists
          const { data: existing } = await supabase
            .from('renewal_records')
            .select('id')
            .eq('agency_id', agencyId)
            .eq('policy_number', r.policyNumber)
            .eq('renewal_effective_date', r.renewalEffectiveDate)
            .eq('is_active', true)
            .maybeSingle();

          // Find or create a unified contact for this record
          let contactId: string | null = null;
          if (r.lastName && r.lastName.trim()) {
            try {
              const { data: contactData } = await supabase.rpc('find_or_create_contact', {
                p_agency_id: agencyId,
                p_first_name: r.firstName || null,
                p_last_name: r.lastName,
                p_zip_code: null, // renewal records don't have zip
                p_phone: r.phone || null,
                p_email: r.email || null,
              });
              contactId = contactData;
            } catch (contactErr) {
              console.warn('Failed to create contact for renewal:', contactErr);
            }
          }

          if (existing) {
            // Update existing record
            const { error } = await supabase
              .from('renewal_records')
              .update({
                first_name: r.firstName,
                last_name: r.lastName,
                email: r.email,
                phone: r.phone,
                phone_alt: r.phoneAlt,
                product_name: r.productName,
                product_code: r.productCode,
                original_year: r.originalYear,
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
                contact_id: contactId || existing.contact_id, // preserve existing if new fails
                updated_at: new Date().toISOString(),
              })
              .eq('id', existing.id);

            if (error) throw error;
            return 'updated';
          } else {
            // Insert new record
            const { error } = await supabase
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
                product_code: r.productCode,
                original_year: r.originalYear,
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
                contact_id: contactId,
              });

            if (error) throw error;
            return 'new';
          }
        })
      );

      // Count results
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          if (result.value === 'new') newCount++;
          else updatedCount++;
        } else {
          errorCount++;
          console.error('Record processing error:', result.reason);
        }
      }
    }

    // Invalidate queries so data refreshes
    queryClient.invalidateQueries({ queryKey: ['renewal-records'] });
    queryClient.invalidateQueries({ queryKey: ['renewal-stats'] });
    queryClient.invalidateQueries({ queryKey: ['renewal-uploads'] });
    queryClient.invalidateQueries({ queryKey: ['renewal-activities'] });

    // Show completion toast
    const totalProcessed = newCount + updatedCount;
    if (errorCount === 0) {
      toast({
        title: 'Renewal Upload Complete!',
        description: `${totalProcessed} records processed (${newCount} new, ${updatedCount} updated) from ${filename}`,
      });
    } else {
      toast({
        title: 'Upload completed with issues',
        description: `${totalProcessed} succeeded, ${errorCount} failed from ${filename}`,
        variant: 'destructive',
      });
    }

  } catch (error: any) {
    console.error('Background processing error:', error);
    toast({
      title: 'Renewal Upload Failed',
      description: error.message || 'An error occurred during processing',
      variant: 'destructive',
    });
  }
}
