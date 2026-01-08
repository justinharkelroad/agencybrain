import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { ParsedLeadRow, LeadUploadContext } from '@/types/lqs';

const BATCH_SIZE = 50;

/**
 * Normalize phone number for deduplication (remove non-digits)
 */
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Merge phone arrays, deduplicating by normalized value
 */
function mergePhones(existing: string[] | null, incoming: string[] | null): string[] {
  const existingPhones = existing || [];
  const newPhones = incoming || [];
  
  // Track seen normalized values
  const seen = new Set(existingPhones.map(normalizePhone));
  const merged = [...existingPhones];
  
  for (const phone of newPhones) {
    const normalized = normalizePhone(phone);
    if (normalized && !seen.has(normalized)) {
      merged.push(phone);
      seen.add(normalized);
    }
  }
  
  return merged;
}

export function useLeadBackgroundUpload() {
  const queryClient = useQueryClient();

  const startBackgroundUpload = (
    records: ParsedLeadRow[],
    context: LeadUploadContext,
    sourceDisplayName: string
  ) => {
    // Show immediate feedback
    toast({
      title: `Processing ${records.length} leads...`,
      description: "You can navigate away. We'll notify you when complete.",
    });

    // Fire and forget - process in background
    processInBackground(records, context, sourceDisplayName, queryClient);
  };

  return { startBackgroundUpload };
}

async function processInBackground(
  records: ParsedLeadRow[],
  context: LeadUploadContext,
  sourceDisplayName: string,
  queryClient: ReturnType<typeof useQueryClient>
) {
  const today = new Date().toISOString().split('T')[0];
  let leadsCreated = 0;
  let leadsUpdated = 0;
  let errorCount = 0;

  try {
    const totalRecords = records.length;

    for (let i = 0; i < totalRecords; i += BATCH_SIZE) {
      const batch = records.slice(i, Math.min(i + BATCH_SIZE, totalRecords));

      // Progress toast for large uploads (every 100 records after the first 100)
      if (totalRecords > 100 && i > 0 && i % 100 === 0) {
        toast({
          title: 'Processing leads...',
          description: `${i} of ${totalRecords} processed`,
        });
      }

      const batchResults = await Promise.allSettled(
        batch.map(async (record) => {
          // Check if household exists
          const { data: existing, error: fetchError } = await supabase
            .from('lqs_households')
            .select('id, lead_source_id, phone, email, products_interested')
            .eq('agency_id', context.agencyId)
            .eq('household_key', record.householdKey)
            .maybeSingle();

          if (fetchError) {
            throw new Error(fetchError.message);
          }

          if (existing) {
            // UPDATE existing - merge data, KEEP existing lead_source if already set
            const updates: Record<string, any> = {};

            // Merge phone arrays with deduplication
            if (record.phones && record.phones.length > 0) {
              const existingPhones = existing.phone as string[] | null;
              const mergedPhones = mergePhones(existingPhones, record.phones);
              if (mergedPhones.length > (existingPhones?.length || 0)) {
                updates.phone = mergedPhones;
              }
            }
            
            // Only update email if new value exists and existing is null
            if (record.email && !existing.email) {
              updates.email = record.email;
            }
            if (record.productsInterested && !existing.products_interested) {
              updates.products_interested = record.productsInterested;
            }

            // If existing has no lead source, assign the new one and clear needs_attention
            if (!existing.lead_source_id) {
              updates.lead_source_id = context.leadSourceId;
              updates.needs_attention = false;
            }

            if (Object.keys(updates).length > 0) {
              const { error: updateError } = await supabase
                .from('lqs_households')
                .update(updates)
                .eq('id', existing.id);

              if (updateError) {
                throw new Error(updateError.message);
              }
            }

            return 'updated';
          } else {
            // INSERT new household with phone as array
            const { error: insertError } = await supabase
              .from('lqs_households')
              .insert({
                agency_id: context.agencyId,
                household_key: record.householdKey,
                first_name: record.firstName,
                last_name: record.lastName,
                zip_code: record.zipCode,
                phone: record.phones,  // Already an array
                email: record.email,
                products_interested: record.productsInterested,
                lead_source_id: context.leadSourceId,
                status: 'lead',
                lead_received_date: record.leadDate || today,
                needs_attention: false,
              });

            if (insertError) {
              throw new Error(insertError.message);
            }

            return 'new';
          }
        })
      );

      // Count results
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          if (result.value === 'new') leadsCreated++;
          else leadsUpdated++;
        } else {
          errorCount++;
        }
      }
    }

    // Invalidate queries to refresh LQS data
    queryClient.invalidateQueries({ queryKey: ['lqs-households'] });
    queryClient.invalidateQueries({ queryKey: ['lqs-data'] });
    queryClient.invalidateQueries({ queryKey: ['lqs-stats'] });

    // Show completion toast
    const total = leadsCreated + leadsUpdated;
    if (errorCount === 0) {
      toast({
        title: 'Lead Upload Complete!',
        description: `${total} leads processed (${leadsCreated} new, ${leadsUpdated} updated) → ${sourceDisplayName}`,
      });
    } else {
      toast({
        title: 'Upload completed with issues',
        description: `${total} succeeded, ${errorCount} failed`,
        variant: 'destructive',
      });
    }
  } catch (error: any) {
    toast({
      title: 'Lead Upload Failed',
      description: error.message || 'An error occurred during processing',
      variant: 'destructive',
    });
  }
}
