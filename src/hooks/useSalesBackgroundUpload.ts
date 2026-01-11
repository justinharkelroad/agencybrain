import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { ParsedSaleRow, SalesUploadContext, SalesUploadResult } from '@/types/lqs';
import { generateHouseholdKey, normalizeProductType } from '@/lib/lqs-sales-parser';

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

export function useSalesBackgroundUpload() {
  const queryClient = useQueryClient();

  const startBackgroundUpload = (
    records: ParsedSaleRow[],
    context: SalesUploadContext,
    onComplete?: (result: SalesUploadResult) => void
  ) => {
    // Show immediate feedback
    toast({
      title: `Processing ${records.length} sales...`,
      description: "You can navigate away. We'll notify you when complete.",
    });

    // Fire and forget - process in background
    processInBackground(records, context, queryClient, onComplete);
  };

  return { startBackgroundUpload };
}

async function processInBackground(
  records: ParsedSaleRow[],
  context: SalesUploadContext,
  queryClient: ReturnType<typeof useQueryClient>,
  onComplete?: (result: SalesUploadResult) => void
) {
  let householdsMatched = 0;
  let householdsCreated = 0;
  let salesCreated = 0;
  let quotesLinked = 0;
  const matchedTeamMemberIds = new Set<string>();
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

    // Group records by household_key to prevent duplicate key errors
    const householdRecordsMap = new Map<string, ParsedSaleRow[]>();
    
    for (const record of records) {
      const householdKey = generateHouseholdKey(record.firstName, record.lastName, record.zipCode);
      const existing = householdRecordsMap.get(householdKey) || [];
      existing.push(record);
      householdRecordsMap.set(householdKey, existing);
    }
    
    console.log(`[Sales Upload] Grouped ${records.length} records into ${householdRecordsMap.size} unique households`);

    // Convert to array of { householdKey, records }
    const householdGroups = Array.from(householdRecordsMap.entries()).map(([key, recs]) => ({
      householdKey: key,
      records: recs,
      primaryRecord: recs[0],
    }));

    const totalGroups = householdGroups.length;

    for (let batchStart = 0; batchStart < totalGroups; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, totalGroups);
      const batch = householdGroups.slice(batchStart, batchEnd);

      // Progress toast for large uploads
      if (totalGroups > 100 && batchStart > 0 && batchStart % 100 === 0) {
        toast({
          title: 'Processing sales...',
          description: `${batchStart} of ${totalGroups} households processed`,
        });
      }

      const batchResults = await Promise.allSettled(
        batch.map(async (group) => {
          const { householdKey, records: groupRecords, primaryRecord } = group;
          
          // Match sub-producer to team member
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

          // Check if household exists
          const { data: existingHousehold } = await supabase
            .from('lqs_households')
            .select('id, status, lead_source_id')
            .eq('agency_id', context.agencyId)
            .eq('household_key', householdKey)
            .maybeSingle();

          let householdId: string;
          let wasCreated = false;
          let needsAttention = false;

          if (existingHousehold) {
            // Household exists - update status to 'sold' and set sold_date
            householdId = existingHousehold.id;
            needsAttention = !existingHousehold.lead_source_id;
            
            // Update household to sold status
            await supabase
              .from('lqs_households')
              .update({
                status: 'sold',
                sold_date: primaryRecord.saleDate,
                team_member_id: teamMemberId || undefined,
              })
              .eq('id', householdId);
          } else {
            // Create new household with sold status
            const { data: newHousehold, error: createError } = await supabase
              .from('lqs_households')
              .insert({
                agency_id: context.agencyId,
                household_key: householdKey,
                first_name: primaryRecord.firstName,
                last_name: primaryRecord.lastName,
                zip_code: primaryRecord.zipCode,
                status: 'sold',
                sold_date: primaryRecord.saleDate,
                team_member_id: teamMemberId,
                needs_attention: true, // No lead source
              })
              .select('id')
              .single();

            if (createError) {
              // Try to fetch if it was created by another concurrent request
              const { data: retryHousehold } = await supabase
                .from('lqs_households')
                .select('id')
                .eq('agency_id', context.agencyId)
                .eq('household_key', householdKey)
                .maybeSingle();
                
              if (retryHousehold) {
                householdId = retryHousehold.id;
              } else {
                throw new Error(`Failed to create household: ${createError.message}`);
              }
            } else {
              householdId = newHousehold.id;
            }
            wasCreated = true;
            needsAttention = true;
          }

          // Process all sales for this household
          let salesCreatedInGroup = 0;
          let quotesLinkedInGroup = 0;
          
          for (const record of groupRecords) {
            // Try to find matching quote by product type
            let linkedQuoteId: string | null = null;
            
            const { data: matchingQuote } = await supabase
              .from('lqs_quotes')
              .select('id')
              .eq('household_id', householdId)
              .eq('product_type', record.productType)
              .order('quote_date', { ascending: false })
              .limit(1)
              .maybeSingle();
              
            if (matchingQuote) {
              linkedQuoteId = matchingQuote.id;
              quotesLinkedInGroup++;
            }

            // Determine team member for this specific sale
            let saleTeamMemberId = teamMemberId;
            if (record.subProducerCode && record.subProducerCode !== primaryRecord.subProducerCode) {
              const matched = codeToMember.get(record.subProducerCode.toLowerCase());
              if (matched) {
                saleTeamMemberId = matched.id;
              }
            }
            
            // Insert sale record
            const { error: saleError } = await supabase
              .from('lqs_sales')
              .insert({
                household_id: householdId,
                agency_id: context.agencyId,
                team_member_id: saleTeamMemberId,
                sale_date: record.saleDate,
                product_type: record.productType,
                items_sold: record.itemsSold,
                policies_sold: 1,
                premium_cents: record.premiumCents,
                policy_number: record.policyNumber,
                source: 'lqs_upload',
                linked_quote_id: linkedQuoteId,
              });

            if (saleError) {
              throw new Error(`Failed to insert sale: ${saleError.message}`);
            }
            
            salesCreatedInGroup++;
          }

          return {
            matchedTeamMemberId: teamMemberId,
            wasCreated,
            needsAttention,
            salesCreatedInGroup,
            quotesLinkedInGroup,
          };
        })
      );

      // Count results
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          const value = result.value;
          if (value.matchedTeamMemberId) matchedTeamMemberIds.add(value.matchedTeamMemberId);
          if (value.wasCreated) householdsCreated++;
          else householdsMatched++;
          salesCreated += value.salesCreatedInGroup;
          quotesLinked += value.quotesLinkedInGroup;
          if (value.needsAttention) householdsNeedingAttention++;
        } else {
          errorCount++;
          errors.push(result.reason?.message || 'Unknown error');
        }
      }
    }

    // Invalidate queries
    queryClient.invalidateQueries({ queryKey: ['lqs-households'] });
    queryClient.invalidateQueries({ queryKey: ['lqs-data'] });
    queryClient.invalidateQueries({ queryKey: ['lqs-stats'] });

    // Build final result
    const result: SalesUploadResult = {
      success: errorCount === 0,
      recordsProcessed: records.length,
      salesCreated,
      householdsMatched,
      householdsCreated,
      quotesLinked,
      teamMembersMatched: matchedTeamMemberIds.size,
      unmatchedProducers: Array.from(unmatchedProducerSet),
      householdsNeedingAttention,
      endorsementsSkipped: 0, // Already filtered during parsing
      errors,
    };

    console.log(`[Sales Upload] Complete: ${salesCreated} sales created, ${householdsMatched} matched, ${householdsCreated} created, ${quotesLinked} quotes linked, ${errorCount} errors`);

    // Show completion toast
    if (errorCount === 0) {
      toast({
        title: 'Sales Upload Complete!',
        description: `${salesCreated} sales processed (${householdsMatched} matched, ${householdsCreated} new households)`,
      });
    } else {
      toast({
        title: 'Upload completed with issues',
        description: `${salesCreated} succeeded, ${errorCount} failed`,
        variant: 'destructive',
      });
    }

    // Callback with results
    if (onComplete) {
      onComplete(result);
    }

  } catch (error: any) {
    toast({
      title: 'Sales Upload Failed',
      description: error.message || 'An error occurred during processing',
      variant: 'destructive',
    });
    
    if (onComplete) {
      onComplete({
        success: false,
        recordsProcessed: 0,
        salesCreated: 0,
        householdsMatched: 0,
        householdsCreated: 0,
        quotesLinked: 0,
        teamMembersMatched: 0,
        unmatchedProducers: [],
        householdsNeedingAttention: 0,
        endorsementsSkipped: 0,
        errors: [error.message || 'Unknown error'],
      });
    }
  }
}
