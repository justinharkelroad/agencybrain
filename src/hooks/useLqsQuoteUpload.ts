import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { ParsedQuoteRow, QuoteUploadContext, QuoteUploadResult } from '@/types/lqs';
import { generateHouseholdKey } from '@/lib/lqs-quote-parser';

interface TeamMember {
  id: string;
  name: string;
  sub_producer_code: string | null;
}

const BATCH_SIZE = 50;

/**
 * Normalize name for fuzzy matching:
 * - Uppercase
 * - Remove non-alpha characters
 * - Split into parts
 */
function normalizeNameForMatch(name: string): string[] {
  const asciiName = name.normalize('NFD').replace(/[\u0300-\u036f]+/g, '');
  return asciiName.toUpperCase().replace(/[^A-Z\s]/g, '').split(/\s+/).filter(Boolean);
}

/**
 * Fuzzy match a name against team members
 * Returns the best matching team member or null
 */
function fuzzyMatchTeamMember(nameParts: string[], teamMembers: TeamMember[]): TeamMember | null {
  if (nameParts.length === 0) return null;
  
  let bestMatch: TeamMember | null = null;
  let bestScore = 0;
  
  for (const member of teamMembers) {
    const memberParts = normalizeNameForMatch(member.name);
    if (memberParts.length === 0) continue;
    
    // Count matching parts
    let matchCount = 0;
    for (const part of nameParts) {
      if (memberParts.some(mp => mp.includes(part) || part.includes(mp))) {
        matchCount++;
      }
    }
    
    // Score is the percentage of input parts that matched
    const score = matchCount / nameParts.length;
    
    // Require at least 50% match and both first and last name portion to match
    if (score >= 0.5 && matchCount >= 2 && score > bestScore) {
      bestScore = score;
      bestMatch = member;
    }
  }
  
  return bestMatch;
}

export function useLqsQuoteUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const uploadQuotes = useCallback(async (
    records: ParsedQuoteRow[],
    context: QuoteUploadContext
  ): Promise<QuoteUploadResult> => {
    setIsUploading(true);
    setProgress(0);
    setError(null);

    const result: QuoteUploadResult = {
      success: false,
      recordsProcessed: 0,
      householdsCreated: 0,
      householdsUpdated: 0,
      quotesCreated: 0,
      quotesUpdated: 0,
      teamMembersMatched: 0,
      unmatchedProducers: [],
      householdsNeedingAttention: 0,
      errors: [],
      salesLinked: 0,
      salesNoMatch: 0,
    };

    const unmatchedProducerSet = new Set<string>();

    try {
      // Step 1: Fetch team members for this agency
      const { data: teamMembers, error: tmError } = await supabase
        .from('team_members')
        .select('id, name, sub_producer_code')
        .eq('agency_id', context.agencyId);

      if (tmError) {
        throw new Error(`Failed to fetch team members: ${tmError.message}`);
      }

      const teamMembersList: TeamMember[] = teamMembers || [];
      
      // Build a map of sub_producer_code → team_member
      const codeToMember = new Map<string, TeamMember>();
      for (const tm of teamMembersList) {
        if (tm.sub_producer_code) {
          codeToMember.set(tm.sub_producer_code.toLowerCase(), tm);
        }
      }

      // Step 2: Process records in batches
      const totalRecords = records.length;
      
      for (let batchStart = 0; batchStart < totalRecords; batchStart += BATCH_SIZE) {
        const batchEnd = Math.min(batchStart + BATCH_SIZE, totalRecords);
        const batch = records.slice(batchStart, batchEnd);

        for (const record of batch) {
          try {
            // Match sub-producer to team member
            let teamMemberId: string | null = null;
            
            // Try code match first
            if (record.subProducerCode) {
              const matched = codeToMember.get(record.subProducerCode.toLowerCase());
              if (matched) {
                teamMemberId = matched.id;
                result.teamMembersMatched++;
              }
            }
            
            // Try fuzzy name match if no code match
            if (!teamMemberId && record.subProducerName) {
              const nameParts = normalizeNameForMatch(record.subProducerName);
              const matched = fuzzyMatchTeamMember(nameParts, teamMembersList);
              if (matched) {
                teamMemberId = matched.id;
                result.teamMembersMatched++;
              }
            }
            
            // Track unmatched
            if (!teamMemberId && record.subProducerRaw) {
              unmatchedProducerSet.add(record.subProducerRaw);
            }

            // Step 3: Upsert household
            const householdKey = generateHouseholdKey(record.firstName, record.lastName, record.zipCode);
            
            // Check if household exists
            const { data: existingHousehold } = await supabase
              .from('lqs_households')
              .select('id, lead_source_id')
              .eq('agency_id', context.agencyId)
              .eq('household_key', householdKey)
              .maybeSingle();

            let householdId: string;
            
            if (existingHousehold) {
              // Update existing household
              householdId = existingHousehold.id;
              
              // Only update if we have a team member and the existing doesn't
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
              
              result.householdsUpdated++;
            } else {
              // Create new household
              const { data: newHousehold, error: hhError } = await supabase
                .from('lqs_households')
                .insert({
                  agency_id: context.agencyId,
                  household_key: householdKey,
                  first_name: record.firstName,
                  last_name: record.lastName,
                  zip_code: record.zipCode,
                  lead_source_id: null, // Will be assigned later
                  status: 'lead', // Trigger will update to 'quoted'
                  lead_received_date: record.quoteDate,
                  team_member_id: teamMemberId,
                  needs_attention: true, // New households need lead source assignment
                })
                .select('id')
                .single();

              if (hhError) {
                throw new Error(`Failed to create household: ${hhError.message}`);
              }
              
              householdId = newHousehold.id;
              result.householdsCreated++;
              result.householdsNeedingAttention++;
            }

            // Step 4: Upsert quote
            // Check if quote exists
            const { data: existingQuote } = await supabase
              .from('lqs_quotes')
              .select('id')
              .eq('agency_id', context.agencyId)
              .eq('household_id', householdId)
              .eq('quote_date', record.quoteDate)
              .eq('product_type', record.productType)
              .maybeSingle();

            if (existingQuote) {
              // Update existing quote
              await supabase
                .from('lqs_quotes')
                .update({
                  items_quoted: record.itemsQuoted,
                  premium_cents: record.premiumCents,
                  issued_policy_number: record.issuedPolicyNumber,
                  team_member_id: teamMemberId,
                })
                .eq('id', existingQuote.id);
              
              result.quotesUpdated++;
            } else {
              // Create new quote
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
              
              result.quotesCreated++;
            }

            result.recordsProcessed++;
          } catch (recordError: any) {
            result.errors.push(`Row ${record.rowNumber}: ${recordError.message}`);
          }
        }

        // Update progress
        setProgress(Math.round((batchEnd / totalRecords) * 100));
      }

      result.unmatchedProducers = Array.from(unmatchedProducerSet);

      // Step 5: Auto-sync sales to newly created/updated households
      try {
        const { data: syncResults, error: syncError } = await supabase
          .rpc('backfill_lqs_sales_matching', { p_agency_id: context.agencyId });
        
        if (!syncError && syncResults && Array.isArray(syncResults)) {
          result.salesLinked = syncResults.filter(
            (r: { status: string }) => r.status === 'linked'
          ).length;
          result.salesNoMatch = syncResults.filter(
            (r: { status: string }) => r.status === 'no_match'
          ).length;
        }
      } catch (syncErr) {
        // Don't fail the whole upload if sync fails - just log it
        console.error('Sales sync failed:', syncErr);
      }

      result.success = result.errors.length === 0 || result.recordsProcessed > 0;
      
    } catch (err: any) {
      result.errors.push(err.message);
      setError(err.message);
    } finally {
      setIsUploading(false);
      setProgress(100);
    }

    return result;
  }, []);

  return {
    uploadQuotes,
    isUploading,
    progress,
    error,
  };
}
