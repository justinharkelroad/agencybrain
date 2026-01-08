import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { ParsedQuoteRow, QuoteUploadContext } from '@/types/lqs';
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
    context: QuoteUploadContext
  ) => {
    // Show immediate feedback
    toast({
      title: `Processing ${records.length} quotes...`,
      description: "You can navigate away. We'll notify you when complete.",
    });

    // Fire and forget - process in background
    processInBackground(records, context, queryClient);
  };

  return { startBackgroundUpload };
}

async function processInBackground(
  records: ParsedQuoteRow[],
  context: QuoteUploadContext,
  queryClient: ReturnType<typeof useQueryClient>
) {
  let householdsCreated = 0;
  let householdsUpdated = 0;
  let quotesCreated = 0;
  let quotesUpdated = 0;
  let teamMembersMatched = 0;
  let errorCount = 0;
  const unmatchedProducerSet = new Set<string>();

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

    const totalRecords = records.length;

    for (let batchStart = 0; batchStart < totalRecords; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, totalRecords);
      const batch = records.slice(batchStart, batchEnd);

      // Progress toast for large uploads (every 100 records after the first 100)
      if (totalRecords > 100 && batchStart > 0 && batchStart % 100 === 0) {
        toast({
          title: 'Processing quotes...',
          description: `${batchStart} of ${totalRecords} processed`,
        });
      }

      const batchResults = await Promise.allSettled(
        batch.map(async (record) => {
          // Match sub-producer to team member
          let teamMemberId: string | null = null;
          
          // Try code match first
          if (record.subProducerCode) {
            const matched = codeToMember.get(record.subProducerCode.toLowerCase());
            if (matched) {
              teamMemberId = matched.id;
              return { type: 'teamMatched' as const };
            }
          }
          
          // Try fuzzy name match
          if (!teamMemberId && record.subProducerName) {
            const nameParts = normalizeNameForMatch(record.subProducerName);
            const matched = fuzzyMatchTeamMember(nameParts, teamMembersList);
            if (matched) {
              teamMemberId = matched.id;
            }
          }
          
          // Track unmatched
          if (!teamMemberId && record.subProducerRaw) {
            unmatchedProducerSet.add(record.subProducerRaw);
          }

          // Upsert household
          const householdKey = generateHouseholdKey(record.firstName, record.lastName, record.zipCode);
          
          const { data: existingHousehold } = await supabase
            .from('lqs_households')
            .select('id, lead_source_id')
            .eq('agency_id', context.agencyId)
            .eq('household_key', householdKey)
            .maybeSingle();

          let householdId: string;
          let householdResult: 'created' | 'updated';
          
          if (existingHousehold) {
            householdId = existingHousehold.id;
            
            const updates: Record<string, any> = {};
            if (teamMemberId) {
              updates.team_member_id = teamMemberId;
            }
            
            if (Object.keys(updates).length > 0) {
              await supabase
                .from('lqs_households')
                .update(updates)
                .eq('id', householdId);
            }
            
            householdResult = 'updated';
          } else {
            const { data: newHousehold, error: hhError } = await supabase
              .from('lqs_households')
              .insert({
                agency_id: context.agencyId,
                household_key: householdKey,
                first_name: record.firstName,
                last_name: record.lastName,
                zip_code: record.zipCode,
                lead_source_id: null,
                status: 'lead',
                lead_received_date: record.quoteDate,
                team_member_id: teamMemberId,
                needs_attention: true,
              })
              .select('id')
              .single();

            if (hhError) {
              throw new Error(`Failed to create household: ${hhError.message}`);
            }
            
            householdId = newHousehold.id;
            householdResult = 'created';
          }

          // Upsert quote
          const { data: existingQuote } = await supabase
            .from('lqs_quotes')
            .select('id')
            .eq('agency_id', context.agencyId)
            .eq('household_id', householdId)
            .eq('quote_date', record.quoteDate)
            .eq('product_type', record.productType)
            .maybeSingle();

          let quoteResult: 'created' | 'updated';

          if (existingQuote) {
            await supabase
              .from('lqs_quotes')
              .update({
                items_quoted: record.itemsQuoted,
                premium_cents: record.premiumCents,
                issued_policy_number: record.issuedPolicyNumber,
                team_member_id: teamMemberId,
              })
              .eq('id', existingQuote.id);
            
            quoteResult = 'updated';
          } else {
            const { error: quoteError } = await supabase
              .from('lqs_quotes')
              .insert({
                household_id: householdId,
                agency_id: context.agencyId,
                team_member_id: teamMemberId,
                quote_date: record.quoteDate,
                product_type: record.productType,
                items_quoted: record.itemsQuoted,
                premium_cents: record.premiumCents,
                issued_policy_number: record.issuedPolicyNumber,
                source: 'allstate_report',
                source_reference_id: null,
              });

            if (quoteError) {
              throw new Error(`Failed to create quote: ${quoteError.message}`);
            }
            
            quoteResult = 'created';
          }

          return {
            teamMatched: teamMemberId !== null,
            householdResult,
            quoteResult,
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
          if (value.quoteResult === 'created') quotesCreated++;
          else if (value.quoteResult === 'updated') quotesUpdated++;
        } else {
          errorCount++;
        }
      }
    }

    // Auto-sync sales
    try {
      await supabase.rpc('backfill_lqs_sales_matching', { p_agency_id: context.agencyId });
    } catch (syncErr) {
      console.error('Sales sync failed:', syncErr);
    }

    // Invalidate queries
    queryClient.invalidateQueries({ queryKey: ['lqs-households'] });
    queryClient.invalidateQueries({ queryKey: ['lqs-data'] });
    queryClient.invalidateQueries({ queryKey: ['lqs-stats'] });

    // Show completion toast
    const totalProcessed = householdsCreated + householdsUpdated;
    
    if (errorCount === 0) {
      toast({
        title: 'Quote Upload Complete!',
        description: `${quotesCreated + quotesUpdated} quotes processed (${quotesCreated} new, ${quotesUpdated} updated)`,
      });
    } else {
      toast({
        title: 'Upload completed with issues',
        description: `${totalProcessed} succeeded, ${errorCount} failed`,
        variant: 'destructive',
      });
    }

    // Show unmatched producers warning if any
    if (unmatchedProducerSet.size > 0) {
      toast({
        title: `${unmatchedProducerSet.size} sub-producer(s) not matched`,
        description: 'Add sub-producer codes to team member profiles for automatic matching.',
        variant: 'default',
      });
    }

  } catch (error: any) {
    toast({
      title: 'Quote Upload Failed',
      description: error.message || 'An error occurred during processing',
      variant: 'destructive',
    });
  }
}
