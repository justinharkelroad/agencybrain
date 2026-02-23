import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import * as winbackApi from '@/lib/winbackApi';
import { calculateWinbackDate, getHouseholdKey, type ParsedWinbackRecord } from '@/lib/winbackParser';
import { useAuth } from '@/lib/auth';

interface WinbackUploadContext {
  agencyId: string;
  userId: string | null;
  contactDaysBefore: number;
}

interface UploadStats {
  processed: number;
  newHouseholds: number;
  newPolicies: number;
  updated: number;
  skipped: number;
}

export function useWinbackBackgroundUpload() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isStaff = winbackApi.isStaffUser();

  const startBackgroundUpload = async (
    records: ParsedWinbackRecord[],
    filename: string,
    context: WinbackUploadContext
  ) => {
    const { agencyId, contactDaysBefore } = context;
    const uniqueHouseholds = new Set(records.map(r => getHouseholdKey(r))).size;

    // Show immediate feedback
    toast.info(`Processing ${records.length} termination records...`, {
      description: `${uniqueHouseholds} unique households. Do not refresh or close this tab.`,
    });

    // Process in background (don't await - fire and forget)
    if (isStaff) {
      processStaffUpload(records, filename, agencyId, contactDaysBefore, user?.id, queryClient);
    } else {
      processInBackground(records, filename, agencyId, contactDaysBefore, user?.id, queryClient);
    }
  };

  return { startBackgroundUpload };
}

async function processStaffUpload(
  records: ParsedWinbackRecord[],
  filename: string,
  agencyId: string,
  contactDaysBefore: number,
  userId: string | undefined,
  queryClient: ReturnType<typeof useQueryClient>
) {
  // Warn user if they try to leave/refresh during processing
  const beforeUnloadHandler = (e: BeforeUnloadEvent) => {
    e.preventDefault();
    e.returnValue = 'Upload is still processing. Leaving will stop the upload.';
    return e.returnValue;
  };
  window.addEventListener('beforeunload', beforeUnloadHandler);

  try {
    // Convert parsed records to serializable format
    const serializedRecords = records.map(record => ({
      firstName: record.firstName,
      lastName: record.lastName,
      zipCode: record.zipCode,
      email: record.email,
      phone: record.phone,
      policyNumber: record.policyNumber,
      agentNumber: record.agentNumber,
      originalYear: record.originalYear,
      productCode: record.productCode,
      productName: record.productName,
      policyTermMonths: record.policyTermMonths,
      renewalEffectiveDate: record.renewalEffectiveDate?.toISOString().split('T')[0],
      anniversaryEffectiveDate: record.anniversaryEffectiveDate?.toISOString().split('T')[0],
      terminationEffectiveDate: record.terminationEffectiveDate.toISOString().split('T')[0],
      terminationReason: record.terminationReason,
      terminationType: record.terminationType,
      premiumNewCents: record.premiumNewCents,
      premiumOldCents: record.premiumOldCents,
      accountType: record.accountType,
      companyCode: record.companyCode,
      isCancelRewrite: record.isCancelRewrite,
    }));

    // For small uploads, use single call. For large uploads, chunk to avoid edge function timeout.
    const BATCH_THRESHOLD = 200; // records (not households)

    if (serializedRecords.length <= BATCH_THRESHOLD) {
      // Small upload: single edge function call
      const stats = await winbackApi.uploadTerminations(
        agencyId,
        serializedRecords,
        filename,
        contactDaysBefore,
        userId
      );

      invalidateWinbackQueries(queryClient);
      toast.success('Termination Upload Complete!', {
        description: `${stats.processed} records (${stats.newHouseholds} new households, ${stats.newPolicies} new policies)`,
      });
    } else {
      // Large upload: chunk into batches to avoid edge function timeout (150s limit)
      const batchSize = BATCH_THRESHOLD;
      const batches: typeof serializedRecords[] = [];
      for (let i = 0; i < serializedRecords.length; i += batchSize) {
        batches.push(serializedRecords.slice(i, i + batchSize));
      }

      const totalStats: UploadStats = { processed: 0, newHouseholds: 0, newPolicies: 0, updated: 0, skipped: 0 };
      const allHouseholdIds: string[] = [];
      const allPolicyIds: string[] = [];

      const progressToastId = toast.loading(`Uploading: batch 0 / ${batches.length}...`, {
        duration: Infinity,
      });

      for (let i = 0; i < batches.length; i++) {
        toast.loading(`Uploading: batch ${i + 1} / ${batches.length}...`, {
          id: progressToastId as string | number,
          duration: Infinity,
        });

        const batchResult = await winbackApi.uploadTerminationsBatch(
          batches[i],
          contactDaysBefore,
        );

        totalStats.processed += batchResult.processed;
        totalStats.newHouseholds += batchResult.newHouseholds;
        totalStats.newPolicies += batchResult.newPolicies;
        totalStats.updated += batchResult.updated;
        totalStats.skipped += batchResult.skipped;
        allHouseholdIds.push(...batchResult.householdIds);
        allPolicyIds.push(...batchResult.policyIds);
      }

      toast.dismiss(progressToastId);

      // Finalize: create upload record and stamp IDs
      await winbackApi.recordUpload(filename, totalStats, allHouseholdIds, allPolicyIds);

      invalidateWinbackQueries(queryClient);
      toast.success('Termination Upload Complete!', {
        description: `${totalStats.processed} records (${totalStats.newHouseholds} new households, ${totalStats.newPolicies} new policies)`,
      });
    }
  } catch (error: any) {
    console.error('Staff upload error:', error);
    toast.error('Termination Upload Failed', {
      description: error.message || 'An error occurred during processing',
    });
  } finally {
    window.removeEventListener('beforeunload', beforeUnloadHandler);
  }
}

async function processInBackground(
  records: ParsedWinbackRecord[],
  filename: string,
  agencyId: string,
  contactDaysBefore: number,
  userId: string | undefined,
  queryClient: ReturnType<typeof useQueryClient>
) {
  // Warn user if they try to leave/refresh during processing
  const beforeUnloadHandler = (e: BeforeUnloadEvent) => {
    e.preventDefault();
    e.returnValue = 'Upload is still processing. Leaving will stop the upload.';
    return e.returnValue;
  };
  window.addEventListener('beforeunload', beforeUnloadHandler);

  try {
    const processedHouseholdIds = new Set<string>();
    const insertedPolicyIds = new Set<string>();

    const stats: UploadStats = {
      processed: 0,
      newHouseholds: 0,
      newPolicies: 0,
      updated: 0,
      skipped: 0,
    };

    // Group records by household key
    const householdGroups = new Map<string, ParsedWinbackRecord[]>();
    for (const record of records) {
      const key = getHouseholdKey(record);
      if (!householdGroups.has(key)) {
        householdGroups.set(key, []);
      }
      householdGroups.get(key)!.push(record);
    }

    const totalHouseholds = householdGroups.size;
    let householdsProcessed = 0;
    // Show progress toast (updates every 25 households)
    const progressToastId = toast.loading(`Uploading: 0 / ${totalHouseholds} households...`, {
      duration: Infinity,
    });

    for (const [, groupRecords] of householdGroups) {
      const firstRecord = groupRecords[0];

      // Check if household exists
      const { data: existingHousehold } = await supabase
        .from('winback_households')
        .select('id')
        .eq('agency_id', agencyId)
        .ilike('first_name', firstRecord.firstName)
        .ilike('last_name', firstRecord.lastName)
        .filter('zip_code', 'like', `${firstRecord.zipCode.substring(0, 5)}%`)
        .maybeSingle();

      let householdId: string;

      // Find or create unified contact for this household
      let contactId: string | null = null;
      if (firstRecord.lastName && firstRecord.lastName.trim()) {
        try {
          const { data: contactData } = await supabase.rpc('find_or_create_contact', {
            p_agency_id: agencyId,
            p_first_name: firstRecord.firstName || null,
            p_last_name: firstRecord.lastName,
            p_zip_code: firstRecord.zipCode || null,
            p_phone: firstRecord.phone || null,
            p_email: firstRecord.email || null,
          });
          contactId = contactData;
        } catch (contactErr) {
          console.warn('Failed to create contact for winback household:', contactErr);
        }
      }

      if (existingHousehold) {
        householdId = existingHousehold.id;
        const updateData: Record<string, any> = {};
        if (firstRecord.email) updateData.email = firstRecord.email;
        if (firstRecord.phone) updateData.phone = firstRecord.phone;
        if (contactId) updateData.contact_id = contactId;

        if (Object.keys(updateData).length > 0) {
          await supabase
            .from('winback_households')
            .update(updateData)
            .eq('id', householdId);
        }
      } else {
        const { data: newHousehold, error: householdError } = await supabase
          .from('winback_households')
          .insert({
            agency_id: agencyId,
            first_name: firstRecord.firstName,
            last_name: firstRecord.lastName,
            zip_code: firstRecord.zipCode,
            email: firstRecord.email,
            phone: firstRecord.phone,
            status: 'untouched',
            contact_id: contactId,
          })
          .select('id')
          .single();

        if (householdError) {
          console.error('Error creating household:', householdError);
          stats.skipped += groupRecords.length;
          continue;
        }

        householdId = newHousehold.id;
        stats.newHouseholds++;
      }

      processedHouseholdIds.add(householdId);

      // Process each policy in this household
      for (const record of groupRecords) {
        const winbackDate = calculateWinbackDate(
          record.terminationEffectiveDate,
          record.policyTermMonths,
          contactDaysBefore
        );

        let premiumChangeCents: number | null = null;
        let premiumChangePercent: number | null = null;
        if (record.premiumNewCents !== null && record.premiumOldCents !== null && record.premiumOldCents > 0) {
          premiumChangeCents = record.premiumNewCents - record.premiumOldCents;
          premiumChangePercent = Math.round((premiumChangeCents / record.premiumOldCents) * 10000) / 100;
        }

        const { data: existingPolicy } = await supabase
          .from('winback_policies')
          .select('id')
          .eq('agency_id', agencyId)
          .eq('policy_number', record.policyNumber)
          .maybeSingle();

        if (existingPolicy) {
          await supabase
            .from('winback_policies')
            .update({
              household_id: householdId,
              termination_effective_date: record.terminationEffectiveDate.toISOString().split('T')[0],
              termination_reason: record.terminationReason,
              termination_type: record.terminationType,
              premium_new_cents: record.premiumNewCents,
              premium_old_cents: record.premiumOldCents,
              premium_change_cents: premiumChangeCents,
              premium_change_percent: premiumChangePercent,
              is_cancel_rewrite: record.isCancelRewrite,
              calculated_winback_date: winbackDate.toISOString().split('T')[0],
              items_count: record.itemsCount,
              line_code: record.lineCode,
              source: 'csv_upload',
            })
            .eq('id', existingPolicy.id);

          stats.updated++;
        } else {
          // Validate required fields before insert
          if (!record.productName && !record.lineCode) {
            console.error('Policy skipped - missing product_name and line_code:', {
              policyNumber: record.policyNumber,
              record,
            });
            stats.skipped++;
            stats.processed++;
            continue;
          }

          const { data: newPolicy, error: policyError } = await supabase
            .from('winback_policies')
            .insert({
              household_id: householdId,
              agency_id: agencyId,
              policy_number: record.policyNumber,
              agent_number: record.agentNumber,
              original_year: record.originalYear,
              product_code: record.productCode,
              product_name: record.productName || `Line ${record.lineCode}`,
              policy_term_months: record.policyTermMonths,
              renewal_effective_date: record.renewalEffectiveDate?.toISOString().split('T')[0] || null,
              anniversary_effective_date: record.anniversaryEffectiveDate?.toISOString().split('T')[0] || null,
              termination_effective_date: record.terminationEffectiveDate.toISOString().split('T')[0],
              termination_reason: record.terminationReason,
              termination_type: record.terminationType,
              premium_new_cents: record.premiumNewCents,
              premium_old_cents: record.premiumOldCents,
              premium_change_cents: premiumChangeCents,
              premium_change_percent: premiumChangePercent,
              account_type: record.accountType,
              company_code: record.companyCode,
              is_cancel_rewrite: record.isCancelRewrite,
              calculated_winback_date: winbackDate.toISOString().split('T')[0],
              items_count: record.itemsCount,
              line_code: record.lineCode,
              source: 'csv_upload',
            })
            .select('id')
            .single();

          if (policyError) {
            console.error('Policy INSERT failed:', {
              error: policyError,
              code: policyError.code,
              message: policyError.message,
              details: policyError.details,
              policyNumber: record.policyNumber,
              productName: record.productName,
              householdId,
            });
            stats.skipped++;
          } else {
            if (newPolicy) insertedPolicyIds.add(newPolicy.id);
            stats.newPolicies++;
          }
        }

        stats.processed++;
      }

      // Recalculate household aggregates
      await supabase.rpc('recalculate_winback_household_aggregates', {
        p_household_id: householdId,
      });

      householdsProcessed++;
      if (householdsProcessed % 25 === 0 || householdsProcessed === totalHouseholds) {
        toast.loading(`Uploading: ${householdsProcessed} / ${totalHouseholds} households...`, {
          id: progressToastId as string | number,
          duration: Infinity,
        });
      }
    }

    // Dismiss the progress toast
    toast.dismiss(progressToastId);

    // Record the upload and get its ID
    const { data: uploadRecord, error: uploadRecordError } = await supabase.from('winback_uploads').insert({
      agency_id: agencyId,
      uploaded_by_user_id: userId || null,
      filename,
      records_processed: stats.processed,
      records_new_households: stats.newHouseholds,
      records_new_policies: stats.newPolicies,
      records_updated: stats.updated,
      records_skipped: stats.skipped,
    }).select('id').single();

    if (uploadRecordError) {
      console.error('Failed to create upload record:', uploadRecordError);
    }

    // Stamp last_upload_id on all processed households
    if (uploadRecord?.id) {
      const allHouseholdIds = Array.from(processedHouseholdIds);
      if (allHouseholdIds.length > 0) {
        await supabase
          .from('winback_households')
          .update({ last_upload_id: uploadRecord.id })
          .in('id', allHouseholdIds);
      }

      // Stamp source_upload_id on newly inserted policies
      const allPolicyIds = Array.from(insertedPolicyIds);
      if (allPolicyIds.length > 0) {
        await supabase
          .from('winback_policies')
          .update({ source_upload_id: uploadRecord.id })
          .in('id', allPolicyIds);
      }
    }

    // Invalidate queries
    invalidateWinbackQueries(queryClient);

    // Show success toast
    if (stats.skipped === 0) {
      toast.success('Termination Upload Complete!', {
        description: `${stats.processed} records (${stats.newHouseholds} new households, ${stats.newPolicies} new policies)`,
      });
    } else {
      toast.warning('Upload completed with issues', {
        description: `${stats.processed} processed, ${stats.skipped} skipped`,
      });
    }
  } catch (error: any) {
    console.error('Background processing error:', error);
    toast.error('Termination Upload Failed', {
      description: error.message || 'An error occurred during processing',
    });
  } finally {
    window.removeEventListener('beforeunload', beforeUnloadHandler);
  }
}

function invalidateWinbackQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['winback-households'] });
  queryClient.invalidateQueries({ queryKey: ['winback-policies'] });
  queryClient.invalidateQueries({ queryKey: ['winback-uploads'] });
  queryClient.invalidateQueries({ queryKey: ['winback-stats'] });
  
  // Dispatch custom event to trigger TerminationAnalytics refresh
  window.dispatchEvent(new CustomEvent('winback-upload-complete'));
}
