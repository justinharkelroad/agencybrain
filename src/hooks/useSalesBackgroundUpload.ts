import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { ParsedSaleRow, SalesUploadContext, SalesUploadResult, MatchCandidate, PendingSaleReview } from '@/types/lqs';
import { generateHouseholdKey, normalizeProductType } from '@/lib/lqs-sales-parser';

interface TeamMember {
  id: string;
  name: string;
  sub_producer_code: string | null;
}

interface HouseholdWithQuotes {
  id: string;
  first_name: string;
  last_name: string;
  zip_code: string | null;
  lead_source_id: string | null;
  team_member_id: string | null;
  quotes: Array<{
    id: string;
    product_type: string;
    premium_cents: number;
    quote_date: string;
  }>;
  lead_source?: { name: string } | null;
}

const BATCH_SIZE = 50;

// Scoring constants
const SCORE_PRODUCT_MATCH = 40;
const SCORE_SUB_PRODUCER_MATCH = 35;
const SCORE_PREMIUM_WITHIN_10 = 25;
const SCORE_QUOTE_DATE_BEFORE_SALE = 10;

// Auto-match thresholds
const AUTO_MATCH_MIN_SCORE = 75;
const AUTO_MATCH_GAP_REQUIRED = 20;

/**
 * Normalize name for fuzzy matching
 */
function normalizeNameForMatch(name: string): string[] {
  return name.toUpperCase().replace(/[^A-Z\s]/g, '').split(/\s+/).filter(Boolean);
}

/**
 * Check if two names are similar enough for matching
 * Returns true if last names match AND first name starts with same letter
 */
function namesMatch(
  saleFirstName: string, 
  saleLastName: string, 
  householdFirstName: string, 
  householdLastName: string
): boolean {
  const normSaleFirst = saleFirstName.toUpperCase().replace(/[^A-Z]/g, '');
  const normSaleLast = saleLastName.toUpperCase().replace(/[^A-Z]/g, '');
  const normHhFirst = householdFirstName.toUpperCase().replace(/[^A-Z]/g, '');
  const normHhLast = householdLastName.toUpperCase().replace(/[^A-Z]/g, '');
  
  // Last names must match exactly
  if (normSaleLast !== normHhLast) return false;
  
  // First name must start with the same letter, or one contains the other
  if (normSaleFirst.length === 0 || normHhFirst.length === 0) return false;
  
  // Check if first letter matches
  if (normSaleFirst[0] !== normHhFirst[0]) return false;
  
  // Additional check: at least one must contain the other (handles DAVID J vs DAVID)
  if (normSaleFirst.includes(normHhFirst) || normHhFirst.includes(normSaleFirst)) {
    return true;
  }
  
  // Or just matching first letter is enough (DAVID J vs DJ would both start with D)
  return true;
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

/**
 * Score a candidate household against a sale record
 */
function scoreCandidate(
  sale: ParsedSaleRow,
  household: HouseholdWithQuotes,
  teamMemberId: string | null
): MatchCandidate {
  let score = 0;
  const matchFactors = {
    productMatch: false,
    subProducerMatch: false,
    premiumWithin10Percent: false,
    quoteDateBeforeSale: false,
  };

  // Find best matching quote
  let bestQuote: HouseholdWithQuotes['quotes'][0] | null = null;
  let bestQuoteScore = 0;

  for (const quote of household.quotes || []) {
    let quoteScore = 0;
    
    // Product match (+40)
    const normalizedSaleProduct = normalizeProductType(sale.productType);
    const normalizedQuoteProduct = normalizeProductType(quote.product_type);
    if (normalizedSaleProduct === normalizedQuoteProduct) {
      quoteScore += SCORE_PRODUCT_MATCH;
    }
    
    // Premium within 10% (+25)
    const premiumDiff = Math.abs(sale.premiumCents - quote.premium_cents);
    const premiumPercent = sale.premiumCents > 0 ? (premiumDiff / sale.premiumCents) * 100 : 100;
    if (premiumPercent <= 10) {
      quoteScore += SCORE_PREMIUM_WITHIN_10;
    }
    
    // Quote date before sale date (+10)
    if (quote.quote_date && sale.saleDate && quote.quote_date <= sale.saleDate) {
      quoteScore += SCORE_QUOTE_DATE_BEFORE_SALE;
    }
    
    if (quoteScore > bestQuoteScore) {
      bestQuoteScore = quoteScore;
      bestQuote = quote;
    }
  }

  score = bestQuoteScore;

  // Sub-producer match (+35) - compare household's team member
  if (teamMemberId && household.team_member_id === teamMemberId) {
    score += SCORE_SUB_PRODUCER_MATCH;
    matchFactors.subProducerMatch = true;
  }

  // Compute match factors based on best quote
  if (bestQuote) {
    matchFactors.productMatch = normalizeProductType(sale.productType) === normalizeProductType(bestQuote.product_type);
    const premiumDiff = Math.abs(sale.premiumCents - bestQuote.premium_cents);
    matchFactors.premiumWithin10Percent = sale.premiumCents > 0 && (premiumDiff / sale.premiumCents) * 100 <= 10;
    matchFactors.quoteDateBeforeSale = !!(bestQuote.quote_date && sale.saleDate && bestQuote.quote_date <= sale.saleDate);
  }

  return {
    householdId: household.id,
    householdName: `${household.first_name} ${household.last_name}`,
    zipCode: household.zip_code,
    leadSourceName: household.lead_source?.name || null,
    quote: bestQuote ? {
      id: bestQuote.id,
      productType: bestQuote.product_type,
      premium: bestQuote.premium_cents / 100,
      quoteDate: bestQuote.quote_date,
    } : null,
    score,
    matchFactors,
  };
}

/**
 * Determine if auto-match should be applied
 * Auto-match if: top score >= 75 AND gap to second place >= 20
 */
function shouldAutoMatch(candidates: MatchCandidate[]): MatchCandidate | null {
  if (candidates.length === 0) return null;
  
  const sorted = [...candidates].sort((a, b) => b.score - a.score);
  const top = sorted[0];
  
  if (top.score < AUTO_MATCH_MIN_SCORE) return null;
  
  if (sorted.length === 1) return top;
  
  const second = sorted[1];
  if (top.score - second.score >= AUTO_MATCH_GAP_REQUIRED) {
    return top;
  }
  
  return null;
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
  let autoMatched = 0;
  let needsReview = 0;
  const pendingReviews: PendingSaleReview[] = [];
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
    
    // Fetch all households with quotes for scoring
    const { data: householdsWithQuotes, error: hqError } = await supabase
      .from('lqs_households')
      .select(`
        id, first_name, last_name, zip_code, lead_source_id, team_member_id,
        quotes:lqs_quotes(id, product_type, premium_cents, quote_date),
        lead_source:lead_sources(name)
      `)
      .eq('agency_id', context.agencyId);
    
    if (hqError) {
      console.warn('[Sales Upload] Failed to fetch households for scoring:', hqError.message);
    }
    
    const allHouseholds: HouseholdWithQuotes[] = (householdsWithQuotes || []) as HouseholdWithQuotes[];

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

          // Check if household exists by exact key match
          const { data: existingHousehold } = await supabase
            .from('lqs_households')
            .select('id, status, lead_source_id')
            .eq('agency_id', context.agencyId)
            .eq('household_key', householdKey)
            .maybeSingle();

          let householdId: string;
          let wasCreated = false;
          let needsAttentionFlag = false;
          let wasAutoMatched = false;
          let needsManualReview = false;
          let reviewCandidates: MatchCandidate[] = [];

          if (existingHousehold) {
            // Household exists - update status to 'sold' and set sold_date
            householdId = existingHousehold.id;
            needsAttentionFlag = !existingHousehold.lead_source_id;
            wasAutoMatched = true; // Exact key match counts as auto-match
            
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
            // No exact key match - try smart matching by NAME (ignore ZIP in matching)
            // CRITICAL: Filter by NAME FIRST, then score by product/premium/producer
            const candidateHouseholds = allHouseholds.filter(h => 
              namesMatch(
                primaryRecord.firstName, 
                primaryRecord.lastName, 
                h.first_name, 
                h.last_name
              )
            );
            
            console.log(`[Sales Upload] Name filter: ${primaryRecord.firstName} ${primaryRecord.lastName} → ${candidateHouseholds.length} name-matched candidates`);
            
            if (candidateHouseholds.length > 0) {
              console.log(`[Sales Upload] Candidates:`, candidateHouseholds.map(h => `${h.first_name} ${h.last_name} (${h.zip_code || 'no zip'})`));
            }
            
            // Score each name-matched candidate
            const scoredCandidates = candidateHouseholds
              .map(h => scoreCandidate(primaryRecord, h, teamMemberId))
              .sort((a, b) => b.score - a.score)
              .slice(0, 5); // Top 5 candidates
            
            // NEW LOGIC: If exactly 1 name-matched household exists, auto-match to it
            // (even if score is low - name match is the primary criterion)
            if (candidateHouseholds.length === 1) {
              // Single name match - always match to this household
              householdId = candidateHouseholds[0].id;
              wasAutoMatched = true;
              console.log(`[Sales Upload] Single name match found: ${candidateHouseholds[0].first_name} ${candidateHouseholds[0].last_name} - auto-matching`);
              
              // Update household to sold status
              await supabase
                .from('lqs_households')
                .update({
                  status: 'sold',
                  sold_date: primaryRecord.saleDate,
                  team_member_id: teamMemberId || undefined,
                })
                .eq('id', householdId);
            } else if (candidateHouseholds.length > 1) {
              // Multiple name matches - check if we can auto-match based on score
              const autoMatchCandidate = shouldAutoMatch(scoredCandidates);
              
              if (autoMatchCandidate) {
                // Auto-match to top scored candidate
                householdId = autoMatchCandidate.householdId;
                wasAutoMatched = true;
                console.log(`[Sales Upload] Auto-matched to: ${autoMatchCandidate.householdName} (score: ${autoMatchCandidate.score})`);
                
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
                // Multiple candidates, none qualify for auto-match - queue for review
                needsManualReview = true;
                reviewCandidates = scoredCandidates;
                console.log(`[Sales Upload] Multiple candidates, needs review:`, scoredCandidates.map(c => `${c.householdName} (${c.score})`));
                
                // Create temporary household for now (can be merged later)
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
                    needs_attention: true,
                  })
                  .select('id')
                  .single();

                if (createError) {
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
                needsAttentionFlag = true;
              }
            } else {
              // No name matches found - create new household
              console.log(`[Sales Upload] No name matches for ${primaryRecord.firstName} ${primaryRecord.lastName} - creating new household`);
              
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
                  needs_attention: true,
                })
                .select('id')
                .single();

              if (createError) {
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
              needsAttentionFlag = true;
            }
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
            needsAttention: needsAttentionFlag,
            wasAutoMatched,
            needsManualReview,
            reviewCandidates,
            primaryRecord,
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
          if (value.wasAutoMatched) autoMatched++;
          if (value.needsManualReview) {
            needsReview++;
            pendingReviews.push({
              sale: value.primaryRecord,
              candidates: value.reviewCandidates,
            });
          }
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
      autoMatched,
      needsReview,
      pendingReviews,
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
        autoMatched: 0,
        needsReview: 0,
        pendingReviews: [],
      });
    }
  }
}
