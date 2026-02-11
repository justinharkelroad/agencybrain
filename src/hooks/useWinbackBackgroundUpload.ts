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
      description: `${uniqueHouseholds} unique households. You can navigate away.`,
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

    const stats = await winbackApi.uploadTerminations(
      agencyId,
      serializedRecords,
      filename,
      contactDaysBefore,
      userId
    );

    // Invalidate queries
    invalidateWinbackQueries(queryClient);

    // Show success toast
    toast.success('Termination Upload Complete!', {
      description: `${stats.processed} records (${stats.newHouseholds} new households, ${stats.newPolicies} new policies)`,
    });
  } catch (error: any) {
    console.error('Staff upload error:', error);
    toast.error('Termination Upload Failed', {
      description: error.message || 'An error occurred during processing',
    });
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
  try {
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

          const { error: policyError } = await supabase
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
            });

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
            stats.newPolicies++;
          }
        }

        stats.processed++;
      }

      // Recalculate household aggregates
      await supabase.rpc('recalculate_winback_household_aggregates', {
        p_household_id: householdId,
      });
    }

    // Record the upload and get its ID
    const { data: uploadRecord } = await supabase.from('winback_uploads').insert({
      agency_id: agencyId,
      uploaded_by_user_id: userId || null,
      filename,
      records_processed: stats.processed,
      records_new_households: stats.newHouseholds,
      records_new_policies: stats.newPolicies,
      records_updated: stats.updated,
      records_skipped: stats.skipped,
    }).select('id').single();

    // Stamp last_upload_id on all processed households
    if (uploadRecord?.id) {
      const allHouseholdIds: string[] = [];
      for (const [, groupRecords] of householdGroups) {
        const firstRecord = groupRecords[0];
        const { data: hh } = await supabase
          .from('winback_households')
          .select('id')
          .eq('agency_id', agencyId)
          .ilike('first_name', firstRecord.firstName)
          .ilike('last_name', firstRecord.lastName)
          .filter('zip_code', 'like', `${firstRecord.zipCode.substring(0, 5)}%`)
          .maybeSingle();
        if (hh) allHouseholdIds.push(hh.id);
      }
      if (allHouseholdIds.length > 0) {
        await supabase
          .from('winback_households')
          .update({ last_upload_id: uploadRecord.id })
          .in('id', allHouseholdIds);
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
