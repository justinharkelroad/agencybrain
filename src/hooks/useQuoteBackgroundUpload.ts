import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { ParsedQuoteRow, QuoteUploadContext, QuoteUploadResult } from '@/types/lqs';
import { generateHouseholdKey } from '@/lib/lqs-quote-parser';

interface TeamMember {
  id: string;
  name: string;
  sub_producer_code: string | null;
}

const BATCH_SIZE = 50;

/**
 * Normalize name for fuzzy matching
 */
function normalizeNameForMatch(name: string): string[] {
  return name.toUpperCase().replace(/[^A-Z\s]/g, '').split(/\s+/).filter(Boolean);
}

/**
 * Fuzzy match a name against team members
 */
function fuzzyMatchTeamMember(nameParts: string[], teamMembers: TeamMember[]): TeamMember | null {
  if (nameParts.length === 0) return null;
  
  let bestMatch: TeamMember | null = null;
  let bestScore = 0;
  
  for (const member of teamMembers) {
    const memberParts = normalizeNameForMatch(member.name);
    if (memberParts.length === 0) continue;
    
    let matchCount = 0;
    for (const part of nameParts) {
      if (memberParts.some(mp => mp.includes(part) || part.includes(mp))) {
        matchCount++;
      }
    }
    
    const score = matchCount / nameParts.length;
    
    if (score >= 0.5 && matchCount >= 2 && score > bestScore) {
      bestScore = score;
      bestMatch = member;
    }
  }
  
  return bestMatch;
}

export function useQuoteBackgroundUpload() {
  const queryClient = useQueryClient();

  const startBackgroundUpload = (
    records: ParsedQuoteRow[],
    context: QuoteUploadContext,
    onComplete?: (result: QuoteUploadResult) => void
  ) => {
    // Show immediate feedback
    toast({
      title: `Processing ${records.length} quotes...`,
      description: "You can navigate away. We'll notify you when complete.",
    });

    // Fire and forget - process in background
    processInBackground(records, context, queryClient, onComplete);
  };

  return { startBackgroundUpload };
}

async function processInBackground(
  records: ParsedQuoteRow[],
  context: QuoteUploadContext,
  queryClient: ReturnType<typeof useQueryClient>,
  onComplete?: (result: QuoteUploadResult) => void
) {
  let householdsCreated = 0;
  let householdsUpdated = 0;
  let quotesCreated = 0;
  let quotesUpdated = 0;
  let teamMembersMatched = 0;
  let errorCount = 0;
  let householdsNeedingAttention = 0;
  const unmatchedProducerSet = new Set<string>();
  const errors: string[] = [];

  try {
    // Fetch team members for this agency
    const { data: teamMembers, error: tmError } = await supabase
      .from('team_members')
      .select('id, name, sub_producer_code')
      .eq('agency_id', context.agencyId);

    if (tmError) {
      throw new Error(`Failed to fetch team members: ${tmError.message}`);
    }

    const teamMembersList: TeamMember[] = teamMembers || [];
    
    // Build code → member map
    const codeToMember = new Map<string, TeamMember>();
    for (const tm of teamMembersList) {
      if (tm.sub_producer_code) {
        codeToMember.set(tm.sub_producer_code.toLowerCase(), tm);
      }
    }

    // In-memory deduplication: group records by household_key
    // This prevents duplicate key errors when same household appears multiple times
    const householdRecordsMap = new Map<string, ParsedQuoteRow[]>();
    
    for (const record of records) {
      const householdKey = generateHouseholdKey(record.firstName, record.lastName, record.zipCode);
      const existing = householdRecordsMap.get(householdKey) || [];
      existing.push(record);
      householdRecordsMap.set(householdKey, existing);
    }
    
    console.log(`[Quote Upload] Deduplicated ${records.length} records into ${householdRecordsMap.size} unique households`);

    // Convert to array of { householdKey, records }
    const householdGroups = Array.from(householdRecordsMap.entries()).map(([key, recs]) => ({
      householdKey: key,
      records: recs,
      // Use first record for household data
      primaryRecord: recs[0],
    }));

    const totalGroups = householdGroups.length;

    for (let batchStart = 0; batchStart < totalGroups; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, totalGroups);
      const batch = householdGroups.slice(batchStart, batchEnd);

      // Progress toast for large uploads (every 100 records after the first 100)
      if (totalGroups > 100 && batchStart > 0 && batchStart % 100 === 0) {
        toast({
          title: 'Processing quotes...',
          description: `${batchStart} of ${totalGroups} households processed`,
        });
      }

      const batchResults = await Promise.allSettled(
        batch.map(async (group) => {
          const { householdKey, records: groupRecords, primaryRecord } = group;
          
          // Match sub-producer to team member (use first record's producer)
          let teamMemberId: string | null = null;
          
          // Try code match first
          if (primaryRecord.subProducerCode) {
            const matched = codeToMember.get(primaryRecord.subProducerCode.toLowerCase());
            if (matched) {
              teamMemberId = matched.id;
            }
          }
          
          // Try fuzzy name match
          if (!teamMemberId && primaryRecord.subProducerName) {
            const nameParts = normalizeNameForMatch(primaryRecord.subProducerName);
            const matched = fuzzyMatchTeamMember(nameParts, teamMembersList);
            if (matched) {
              teamMemberId = matched.id;
            }
          }
          
          // Track unmatched
          if (!teamMemberId && primaryRecord.subProducerRaw) {
            unmatchedProducerSet.add(primaryRecord.subProducerRaw);
          }

          // ATOMIC UPSERT for household - prevents race conditions
          const { data: household, error: hhError } = await supabase
            .from('lqs_households')
            .upsert(
              {
                agency_id: context.agencyId,
                household_key: householdKey,
                first_name: primaryRecord.firstName,
                last_name: primaryRecord.lastName,
                zip_code: primaryRecord.zipCode,
                status: 'lead',
                lead_received_date: primaryRecord.quoteDate,
                team_member_id: teamMemberId,
                needs_attention: true,
              },
              {
                onConflict: 'agency_id,household_key',
                ignoreDuplicates: false,
              }
            )
            .select('id, needs_attention, created_at, updated_at')
            .single();

          if (hhError) {
            throw new Error(`Failed to upsert household: ${hhError.message}`);
          }
          
          const householdId = household.id;
          // Determine if created or updated based on timestamps
          const householdResult: 'created' | 'updated' = 
            household.created_at === household.updated_at ? 'created' : 'updated';
          const needsAttention = household.needs_attention || false;

          // Process all quotes for this household
          let quotesCreatedInGroup = 0;
          let quotesUpdatedInGroup = 0;
          
          for (const record of groupRecords) {
            // Determine team member for this specific quote (may differ from primary)
            let quoteTeamMemberId = teamMemberId;
            if (record.subProducerCode && record.subProducerCode !== primaryRecord.subProducerCode) {
              const matched = codeToMember.get(record.subProducerCode.toLowerCase());
              if (matched) {
                quoteTeamMemberId = matched.id;
              }
            }
            
            // INSERT quote (no unique constraint exists for upsert)
            const { data: quote, error: quoteError } = await supabase
              .from('lqs_quotes')
              .insert({
                household_id: householdId,
                agency_id: context.agencyId,
                team_member_id: quoteTeamMemberId,
                quote_date: record.quoteDate,
                product_type: record.productType,
                items_quoted: record.itemsQuoted,
                premium_cents: record.premiumCents,
                issued_policy_number: record.issuedPolicyNumber,
                source: 'allstate_report',
              })
              .select('id')
              .single();

            if (quoteError) {
              throw new Error(`Failed to insert quote: ${quoteError.message}`);
            }
            
            // Count as created - can't distinguish without updated_at column
            quotesCreatedInGroup++;
          }

          return {
            teamMatched: teamMemberId !== null,
            householdResult,
            quotesCreatedInGroup,
            quotesUpdatedInGroup,
            needsAttention,
          };
        })
      );

      // Count results
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          const value = result.value;
          if (value.teamMatched) teamMembersMatched++;
          if (value.householdResult === 'created') householdsCreated++;
          else if (value.householdResult === 'updated') householdsUpdated++;
          quotesCreated += value.quotesCreatedInGroup;
          quotesUpdated += value.quotesUpdatedInGroup;
          if (value.needsAttention) householdsNeedingAttention++;
        } else {
          errorCount++;
          errors.push(result.reason?.message || 'Unknown error');
        }
      }
    }

    // Auto-sync sales
    let salesLinked = 0;
    let salesNoMatch = 0;
    try {
      const { data: syncResults } = await supabase.rpc('backfill_lqs_sales_matching', { p_agency_id: context.agencyId });
      if (syncResults) {
        salesLinked = syncResults.filter((r: { status: string }) => r.status === 'linked').length;
        salesNoMatch = syncResults.filter((r: { status: string }) => r.status === 'no_match').length;
      }
    } catch (syncErr) {
      console.error('Sales sync failed:', syncErr);
    }

    // Invalidate queries
    queryClient.invalidateQueries({ queryKey: ['lqs-households'] });
    queryClient.invalidateQueries({ queryKey: ['lqs-data'] });
    queryClient.invalidateQueries({ queryKey: ['lqs-stats'] });

    // Build final result
    const result: QuoteUploadResult = {
      success: errorCount === 0,
      recordsProcessed: householdsCreated + householdsUpdated,
      householdsCreated,
      householdsUpdated,
      quotesCreated,
      quotesUpdated,
      teamMembersMatched,
      unmatchedProducers: Array.from(unmatchedProducerSet),
      householdsNeedingAttention,
      errors,
      salesLinked,
      salesNoMatch,
    };

    console.log(`[Quote Upload] Complete: ${householdsCreated} created, ${householdsUpdated} updated, ${quotesCreated} quotes created, ${quotesUpdated} quotes updated, ${errorCount} errors`);

    // Show completion toast
    if (errorCount === 0) {
      toast({
        title: 'Quote Upload Complete!',
        description: `${quotesCreated + quotesUpdated} quotes (${householdsCreated} new, ${householdsUpdated} updated households)`,
      });
    } else {
      toast({
        title: 'Upload completed with issues',
        description: `${householdsCreated + householdsUpdated} succeeded, ${errorCount} failed`,
        variant: 'destructive',
      });
    }

    // Callback with results - page will auto-show modal if warnings
    if (onComplete) {
      onComplete(result);
    }

  } catch (error: any) {
    toast({
      title: 'Quote Upload Failed',
      description: error.message || 'An error occurred during processing',
      variant: 'destructive',
    });
    
    // Send error result to callback
    if (onComplete) {
      onComplete({
        success: false,
        recordsProcessed: 0,
        householdsCreated: 0,
        householdsUpdated: 0,
        quotesCreated: 0,
        quotesUpdated: 0,
        teamMembersMatched: 0,
        unmatchedProducers: [],
        householdsNeedingAttention: 0,
        errors: [error.message || 'Unknown error'],
        salesLinked: 0,
        salesNoMatch: 0,
      });
    }
  }
}
