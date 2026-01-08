import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ParsedLeadRow, LeadUploadContext, LeadUploadResult } from '@/types/lqs';

const BATCH_SIZE = 50;

export function useLeadUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const uploadLeads = useCallback(async (
    records: ParsedLeadRow[],
    context: LeadUploadContext
  ): Promise<LeadUploadResult> => {
    setIsUploading(true);
    setProgress(0);

    const result: LeadUploadResult = {
      success: false,
      recordsProcessed: 0,
      leadsCreated: 0,
      leadsUpdated: 0,
      skipped: 0,
      errors: [],
    };

    const today = new Date().toISOString().split('T')[0];

    try {
      const totalRecords = records.length;

      for (let batchStart = 0; batchStart < totalRecords; batchStart += BATCH_SIZE) {
        const batchEnd = Math.min(batchStart + BATCH_SIZE, totalRecords);
        const batch = records.slice(batchStart, batchEnd);

        for (const record of batch) {
          try {
            // Check if household already exists
            const { data: existingHousehold, error: fetchError } = await supabase
              .from('lqs_households')
              .select('id, lead_source_id, phone, email, products_interested')
              .eq('agency_id', context.agencyId)
              .eq('household_key', record.householdKey)
              .maybeSingle();

            if (fetchError) {
              result.errors.push({ row: record.rowNumber, message: fetchError.message });
              continue;
            }

            if (existingHousehold) {
              // UPDATE existing - merge data, KEEP existing lead_source if already set
              const updates: Record<string, any> = {};
              
              // Only update if new value exists and existing is null
              if (record.phone && !existingHousehold.phone) {
                updates.phone = record.phone;
              }
              if (record.email && !existingHousehold.email) {
                updates.email = record.email;
              }
              if (record.productsInterested && !existingHousehold.products_interested) {
                updates.products_interested = record.productsInterested;
              }
              
              // If existing has no lead source, assign the new one and clear needs_attention
              if (!existingHousehold.lead_source_id) {
                updates.lead_source_id = context.leadSourceId;
                updates.needs_attention = false;
              }

              if (Object.keys(updates).length > 0) {
                const { error: updateError } = await supabase
                  .from('lqs_households')
                  .update(updates)
                  .eq('id', existingHousehold.id);

                if (updateError) {
                  result.errors.push({ row: record.rowNumber, message: updateError.message });
                  continue;
                }
              }

              result.leadsUpdated++;
            } else {
              // INSERT new household
              const { error: insertError } = await supabase
                .from('lqs_households')
                .insert({
                  agency_id: context.agencyId,
                  household_key: record.householdKey,
                  first_name: record.firstName,
                  last_name: record.lastName,
                  zip_code: record.zipCode,
                  phone: record.phone,
                  email: record.email,
                  products_interested: record.productsInterested,
                  lead_source_id: context.leadSourceId,
                  status: 'lead',
                  lead_received_date: record.leadDate || today,
                  needs_attention: false, // Has lead source from upload
                });

              if (insertError) {
                result.errors.push({ row: record.rowNumber, message: insertError.message });
                continue;
              }

              result.leadsCreated++;
            }

            result.recordsProcessed++;
          } catch (recordError: any) {
            result.errors.push({ row: record.rowNumber, message: recordError.message });
          }
        }

        // Update progress
        setProgress(Math.round((batchEnd / totalRecords) * 100));
      }

      result.success = result.recordsProcessed > 0;
    } catch (err: any) {
      result.errors.push({ row: 0, message: err.message });
    } finally {
      setIsUploading(false);
      setProgress(100);
    }

    return result;
  }, []);

  return {
    uploadLeads,
    isUploading,
    progress,
  };
}
