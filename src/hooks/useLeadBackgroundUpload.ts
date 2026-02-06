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
      description: 'Upload in progress. Please keep this tab open.',
    });

    // Fire and forget - process in background
    processInBackground(records, context, sourceDisplayName, queryClient);
  };

  return { startBackgroundUpload };
}

const CONCURRENCY_LIMIT = 5;
const INTER_BATCH_DELAY_MS = 500;
const RETRY_DELAY_MS = 200;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Process a single record against the database. Returns 'new' | 'updated'.
 * Throws on failure.
 */
async function processRecord(
  record: ParsedLeadRow,
  context: LeadUploadContext,
  today: string
): Promise<'new' | 'updated'> {
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

  // Find or create unified contact for this household
  let contactId: string | null = null;
  if (record.lastName && record.lastName.trim()) {
    try {
      const { data: contactData } = await supabase.rpc('find_or_create_contact', {
        p_agency_id: context.agencyId,
        p_first_name: record.firstName || null,
        p_last_name: record.lastName,
        p_zip_code: record.zipCode || null,
        p_phone: record.phones?.[0] || null, // Use first phone
        p_email: record.email || null,
      });
      contactId = contactData;
    } catch (contactErr) {
      console.warn('Failed to create contact for LQS lead:', contactErr);
    }
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

    // Lead source handling with conflict detection
    if (!existing.lead_source_id) {
      // No existing source - assign the new one and clear attention
      updates.lead_source_id = context.leadSourceId;
      updates.needs_attention = false;
      updates.attention_reason = null;
      updates.conflicting_lead_source_id = null;
    } else if (existing.lead_source_id !== context.leadSourceId) {
      // CONFLICT: Different source trying to claim this household
      // Keep original source but flag for review
      updates.needs_attention = true;
      updates.attention_reason = 'source_conflict';
      updates.conflicting_lead_source_id = context.leadSourceId;
      console.log(`[Lead Upload] Source conflict detected: Household ${existing.id} already has source, new source ${context.leadSourceId} flagged`);
    }
    // If same source, do nothing - no conflict

    // Link contact if not already linked
    if (contactId) {
      updates.contact_id = contactId;
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
        contact_id: contactId,
      });

    if (insertError) {
      throw new Error(insertError.message);
    }

    return 'new';
  }
}

/**
 * Process an array of records with a concurrency limit.
 * Processes CONCURRENCY_LIMIT records at a time, waits for all to finish, then next group.
 */
async function processWithConcurrencyLimit(
  records: ParsedLeadRow[],
  context: LeadUploadContext,
  today: string
): Promise<{ created: number; updated: number; failed: { record: ParsedLeadRow; error: string }[] }> {
  let created = 0;
  let updated = 0;
  const failed: { record: ParsedLeadRow; error: string }[] = [];

  for (let i = 0; i < records.length; i += CONCURRENCY_LIMIT) {
    const group = records.slice(i, i + CONCURRENCY_LIMIT);
    const results = await Promise.allSettled(
      group.map((record) => processRecord(record, context, today))
    );

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      if (result.status === 'fulfilled') {
        if (result.value === 'new') created++;
        else updated++;
      } else {
        const record = group[j];
        const errMsg = result.reason?.message || String(result.reason);
        console.error('[Lead Upload] Record failed:', record.householdKey, errMsg);
        failed.push({ record, error: errMsg });
      }
    }
  }

  return { created, updated, failed };
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
  let retrySuccesses = 0;
  const allFailed: { record: ParsedLeadRow; error: string }[] = [];

  try {
    const totalRecords = records.length;
    const totalBatches = Math.ceil(totalRecords / BATCH_SIZE);

    for (let i = 0; i < totalRecords; i += BATCH_SIZE) {
      const batch = records.slice(i, Math.min(i + BATCH_SIZE, totalRecords));
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const endIdx = Math.min(i + BATCH_SIZE, totalRecords);

      console.log(`[Lead Upload] Processing batch ${batchNumber}/${totalBatches}: records ${i + 1}-${endIdx}`);

      // Progress toast for large uploads (every 100 records after the first 100)
      if (totalRecords > 100 && i > 0 && i % 100 === 0) {
        toast({
          title: 'Processing leads...',
          description: `${i} of ${totalRecords} processed`,
        });
      }

      const { created, updated, failed } = await processWithConcurrencyLimit(batch, context, today);

      leadsCreated += created;
      leadsUpdated += updated;
      allFailed.push(...failed);

      console.log(`[Lead Upload] Batch ${batchNumber} complete: ${created} new, ${updated} merged, ${failed.length} failed`);

      // Inter-batch delay to avoid rate-limit pressure
      if (i + BATCH_SIZE < totalRecords) {
        await delay(INTER_BATCH_DELAY_MS);
      }
    }

    // Retry failed records one time, sequentially
    if (allFailed.length > 0) {
      console.log(`[Lead Upload] Retrying ${allFailed.length} failed records sequentially...`);
      const stillFailed: { record: ParsedLeadRow; error: string }[] = [];

      for (const { record } of allFailed) {
        try {
          await processRecord(record, context, today);
          retrySuccesses++;
        } catch (retryErr: any) {
          const errMsg = retryErr?.message || String(retryErr);
          console.error('[Lead Upload] Retry failed:', record.householdKey, errMsg);
          stillFailed.push({ record, error: errMsg });
        }
        await delay(RETRY_DELAY_MS);
      }

      errorCount = stillFailed.length;
      console.log(`[Lead Upload] Retry complete: ${retrySuccesses} recovered, ${errorCount} still failed`);
    }

    console.log(`[Lead Upload] FINAL: ${leadsCreated} created, ${leadsUpdated} updated, ${errorCount} failed, ${retrySuccesses} recovered on retry. Total input: ${records.length}`);

    // Invalidate queries to refresh LQS data
    queryClient.invalidateQueries({ queryKey: ['lqs-households'] });
    queryClient.invalidateQueries({ queryKey: ['lqs-data'] });
    queryClient.invalidateQueries({ queryKey: ['lqs-stats'] });

    // Show completion toast
    if (errorCount === 0 && retrySuccesses === 0) {
      toast({
        title: 'Upload Complete',
        description: `${leadsCreated} new leads, ${leadsUpdated} updated → ${sourceDisplayName}`,
      });
    } else if (errorCount === 0 && retrySuccesses > 0) {
      toast({
        title: 'Upload Complete',
        description: `${leadsCreated} new leads, ${leadsUpdated} updated, ${retrySuccesses} recovered on retry → ${sourceDisplayName}`,
      });
    } else {
      toast({
        title: 'Upload Complete',
        description: `${leadsCreated} new leads, ${leadsUpdated} updated, ${retrySuccesses > 0 ? `${retrySuccesses} recovered on retry, ` : ''}${errorCount} still failed → ${sourceDisplayName}`,
        variant: 'destructive',
      });
      console.error(`[Lead Upload] ${errorCount} records permanently failed. Check logs above for details.`);
    }
  } catch (error: any) {
    console.error('[Lead Upload] Fatal error:', error);
    toast({
      title: 'Lead Upload Failed',
      description: error.message || 'An error occurred during processing',
      variant: 'destructive',
    });
  }
}
