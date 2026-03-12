import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { generateHouseholdKey } from '../_shared/householdKey.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-staff-session',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ParsedSaleRow {
  subProducerRaw: string;
  subProducerCode: string | null;
  subProducerName: string | null;
  firstName: string;
  lastName: string;
  zipCode: string | null;
  saleDate: string;
  productType: string;
  itemsSold: number;
  premiumCents: number;
  policyNumber: string | null;
  householdKey: string;
  rowNumber: number;
  dispositionCode: string | null;
}

interface SalesUploadContext {
  agencyId: string;
  userId: string | null;
  displayName: string;
  isOneCallClose?: boolean;
}

interface MatchCandidate {
  householdId: string;
  householdName: string;
  zipCode: string | null;
  leadSourceName: string | null;
  quote: {
    id: string;
    productType: string;
    premium: number;
    quoteDate: string;
  } | null;
  score: number;
  matchFactors: {
    productMatch: boolean;
    subProducerMatch: boolean;
    premiumWithin10Percent: boolean;
    quoteDateBeforeSale: boolean;
  };
}

interface PendingSaleReview {
  sale: ParsedSaleRow;
  candidates: MatchCandidate[];
}

interface UploadedHouseholdInfo {
  householdId: string;
  contactId: string | null;
  customerName: string;
  customerZip: string | null;
  policies: Array<{ productType: string; policyNumber: string | null; premiumCents: number }>;
}

interface SalesUploadResult {
  success: boolean;
  recordsProcessed: number;
  salesCreated: number;
  householdsMatched: number;
  householdsCreated: number;
  quotesLinked: number;
  teamMembersMatched: number;
  unmatchedProducers: string[];
  householdsNeedingAttention: number;
  endorsementsSkipped: number;
  errors: string[];
  autoMatched: number;
  needsReview: number;
  pendingReviews: PendingSaleReview[];
  uploadedHouseholds: UploadedHouseholdInfo[];
}

interface TeamMember {
  id: string;
  name: string;
  sub_producer_code: string | null;
}

interface ExistingLqsSale {
  id: string;
  household_id?: string | null;
  sale_date: string;
  product_type: string;
  premium_cents: number;
  policy_number: string | null;
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

interface GroupUploadResult {
  matchedTeamMemberId: string | null;
  wasCreated: boolean;
  householdFound: boolean;
  needsAttention: boolean;
  wasAutoMatched: boolean;
  needsManualReview: boolean;
  reviewCandidates: MatchCandidate[];
  primaryRecord: ParsedSaleRow;
  salesCreatedInGroup: number;
  quotesLinkedInGroup: number;
  errors: string[];
  householdId: string | null;
  contactId: string | null;
  customerName: string;
  customerZip: string | null;
  policiesInGroup: Array<{ productType: string; policyNumber: string | null; premiumCents: number }>;
}

interface StaffUserRow {
  id: string;
  agency_id: string;
  team_member_id: string | null;
  display_name: string | null;
  is_active: boolean;
}

interface StaffSessionRow {
  staff_user_id: string;
  expires_at: string;
  is_valid: boolean;
}

interface HouseholdIdLookupRow {
  id: string;
}

interface MatchingQuoteHouseholdRow {
  household_id: string;
}

interface MatchingQuoteRow {
  id: string;
}

interface CandidateHouseholdBaseRow {
  id: string;
  first_name: string;
  last_name: string;
  zip_code: string | null;
  lead_source_id: string | null;
  team_member_id: string | null;
}

interface CandidateQuoteRow {
  id: string;
  household_id: string;
  product_type: string;
  premium_cents: number;
  quote_date: string;
}

interface LeadSourceRow {
  id: string;
  name: string;
}

type AdminClient = any;

const BATCH_SIZE = 50;
const GROUP_CONCURRENCY_LIMIT = 5;
const SCORE_PRODUCT_MATCH = 40;
const SCORE_SUB_PRODUCER_MATCH = 35;
const SCORE_PREMIUM_WITHIN_10 = 25;
const SCORE_QUOTE_DATE_BEFORE_SALE = 10;
const AUTO_MATCH_MIN_SCORE = 75;
const AUTO_MATCH_GAP_REQUIRED = 20;
const LIKELY_PREMIUM_TOLERANCE = 0.03;
const POSSIBLE_PREMIUM_TOLERANCE = 0.05;
const POSSIBLE_DATE_WINDOW_DAYS = 3;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableDbError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  const code = (error.code || '').toUpperCase();
  const message = (error.message || '').toLowerCase();
  return code === '40P01' || code === '40001' || message.includes('deadlock detected') || message.includes('could not serialize');
}

function dayDiffAbsolute(a: string, b: string): number {
  const left = new Date(`${a}T00:00:00Z`).getTime();
  const right = new Date(`${b}T00:00:00Z`).getTime();
  return Math.abs(Math.round((left - right) / (1000 * 60 * 60 * 24)));
}

function withinPremiumTolerance(base: number, candidate: number, tolerance: number): boolean {
  if (base <= 0 || candidate <= 0) return false;
  const diff = Math.abs(base - candidate);
  return diff / base <= tolerance;
}

function normalizeProductType(productType: string): string {
  if (!productType || !productType.trim()) return 'Unknown';

  const upper = productType.toUpperCase().trim();
  const mapping: Record<string, string> = {
    AUTO: 'Standard Auto',
    'STANDARD AUTO': 'Standard Auto',
    'PERSONAL AUTO': 'Standard Auto',
    SA: 'Standard Auto',
    HOME: 'Homeowners',
    HOMEOWNERS: 'Homeowners',
    HOMEOWNER: 'Homeowners',
    HO: 'Homeowners',
    RENTER: 'Renters',
    RENTERS: 'Renters',
    LANDLORD: 'Landlords',
    LANDLORDS: 'Landlords',
    LL: 'Landlords',
    UMBRELLA: 'Personal Umbrella',
    'PERSONAL UMBRELLA': 'Personal Umbrella',
    PUP: 'Personal Umbrella',
    'MOTOR CLUB': 'Motor Club',
    MOTORCLUB: 'Motor Club',
    MC: 'Motor Club',
    CONDO: 'Condo',
    CONDOMINIUM: 'Condo',
    MOBILEHOME: 'Mobilehome',
    'MOBILE HOME': 'Mobilehome',
    MH: 'Mobilehome',
    'AUTO - SPECIAL': 'Auto - Special',
    'AUTO-SPECIAL': 'Auto - Special',
    'SPECIAL AUTO': 'Auto - Special',
    'NON-STANDARD AUTO': 'Auto - Special',
  };

  if (mapping[upper]) return mapping[upper];

  const lineCodeMatch = upper.match(/^(\d{3})\s*-\s*/);
  if (lineCodeMatch) {
    const lineCodeMap: Record<string, string> = {
      '010': 'Standard Auto',
      '020': 'Motorcycle',
      '021': 'Motorcycle',
      '070': 'Homeowners',
      '072': 'Landlords',
      '073': 'Renters',
      '074': 'Condo',
      '078': 'Condo',
      '080': 'Boatowners',
      '090': 'Personal Umbrella',
    };
    return lineCodeMap[lineCodeMatch[1]] || productType;
  }

  return productType;
}

function isSamePolicyProduct(
  existing: ExistingLqsSale,
  policyNumber: string | null,
  productType: string,
): boolean {
  const normalizedPolicyNumber = (policyNumber || '').trim().toLowerCase();
  if (!normalizedPolicyNumber) return false;

  return (existing.policy_number || '').trim().toLowerCase() === normalizedPolicyNumber &&
    normalizeProductType(existing.product_type).toLowerCase() === normalizeProductType(productType).toLowerCase();
}

function hasCrossHouseholdPolicyDuplicate(
  existingSales: ExistingLqsSale[],
  householdId: string,
  policyNumber: string | null,
  productType: string,
): boolean {
  return existingSales.some((existing) =>
    isSamePolicyProduct(existing, policyNumber, productType) &&
    existing.household_id !== householdId
  );
}

function buildDedupeFingerprint(
  agencyId: string,
  householdId: string,
  saleDate: string,
  productType: string,
  policyNumber: string | null,
): string {
  const normalizedProduct = normalizeProductType(productType).toLowerCase();
  const normalizedPolicy = (policyNumber || '').trim().toLowerCase();
  return [agencyId, householdId, saleDate, normalizedProduct, normalizedPolicy].join('|');
}

function normalizeNameForMatch(name: string): string[] {
  const asciiName = name.normalize('NFD').replace(/[\u0300-\u036f]+/g, '');
  return asciiName.toUpperCase().replace(/[^A-Z\s]/g, '').split(/\s+/).filter(Boolean);
}

function fuzzyMatchTeamMember(nameParts: string[], teamMembers: TeamMember[]): TeamMember | null {
  if (nameParts.length === 0) return null;

  let bestMatch: TeamMember | null = null;
  let bestScore = 0;

  for (const member of teamMembers) {
    const memberParts = normalizeNameForMatch(member.name);
    if (memberParts.length === 0) continue;

    let matchCount = 0;
    for (const part of nameParts) {
      if (memberParts.some((mp) => mp.includes(part) || part.includes(mp))) {
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

function scoreCandidate(
  sale: ParsedSaleRow,
  household: HouseholdWithQuotes,
  teamMemberId: string | null,
): MatchCandidate {
  let score = 0;
  const matchFactors = {
    productMatch: false,
    subProducerMatch: false,
    premiumWithin10Percent: false,
    quoteDateBeforeSale: false,
  };

  let bestQuote: HouseholdWithQuotes['quotes'][0] | null = null;
  let bestQuoteScore = 0;

  for (const quote of household.quotes || []) {
    let quoteScore = 0;

    const normalizedSaleProduct = normalizeProductType(sale.productType);
    const normalizedQuoteProduct = normalizeProductType(quote.product_type);
    if (normalizedSaleProduct === normalizedQuoteProduct) {
      quoteScore += SCORE_PRODUCT_MATCH;
    }

    const premiumDiff = Math.abs(sale.premiumCents - quote.premium_cents);
    const premiumPercent = sale.premiumCents > 0 ? (premiumDiff / sale.premiumCents) * 100 : 100;
    if (premiumPercent <= 10) {
      quoteScore += SCORE_PREMIUM_WITHIN_10;
    }

    if (quote.quote_date && sale.saleDate && quote.quote_date <= sale.saleDate) {
      quoteScore += SCORE_QUOTE_DATE_BEFORE_SALE;
    }

    if (quoteScore > bestQuoteScore) {
      bestQuoteScore = quoteScore;
      bestQuote = quote;
    }
  }

  score = bestQuoteScore;

  if (teamMemberId && household.team_member_id === teamMemberId) {
    score += SCORE_SUB_PRODUCER_MATCH;
    matchFactors.subProducerMatch = true;
  }

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

interface AutoMatchResult {
  match: MatchCandidate | null;
  reason: string;
  scores: string;
}

function shouldAutoMatch(candidates: MatchCandidate[], saleName: string): AutoMatchResult {
  if (candidates.length === 0) {
    return { match: null, reason: 'no_candidates', scores: 'N/A' };
  }

  const sorted = [...candidates].sort((a, b) => b.score - a.score);
  const top = sorted[0];
  const scoresStr = sorted.slice(0, 3).map((candidate) => candidate.score).join('/');

  if (sorted.length === 1) {
    console.log(`[Sales Match] AUTO-MATCH (single candidate): '${saleName}' -> ${top.householdName} (${top.score})`);
    return { match: top, reason: 'single_candidate', scores: scoresStr };
  }

  const second = sorted[1];
  const gap = top.score - second.score;

  if (top.score < AUTO_MATCH_MIN_SCORE) {
    return { match: null, reason: 'score_below_threshold', scores: scoresStr };
  }

  if (gap >= AUTO_MATCH_GAP_REQUIRED) {
    return { match: top, reason: 'clear_leader', scores: scoresStr };
  }

  return { match: null, reason: 'no_clear_leader', scores: scoresStr };
}

function buildSaleErrorPrefix(record: ParsedSaleRow): string {
  const policyLabel = record.policyNumber ? `policy ${record.policyNumber}` : 'no policy number';
  return `Row ${record.rowNumber}: ${record.firstName} ${record.lastName} (${policyLabel})`;
}

function isDuplicateSkipMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes('skipped as a duplicate') ||
    lower.includes('likely duplicate') ||
    lower.includes('already exists in lqs and was skipped');
}

async function verifyStaffRequest(admin: AdminClient, sessionToken: string): Promise<StaffUserRow | null> {
  const nowIso = new Date().toISOString();
  const { data: session, error: sessionError } = await admin
    .from('staff_sessions')
    .select('staff_user_id, expires_at, is_valid')
    .eq('session_token', sessionToken)
    .eq('is_valid', true)
    .gt('expires_at', nowIso)
    .maybeSingle();

  if (sessionError || !session) {
    console.error('[upload_staff_lqs_sales] Session verification failed:', sessionError);
    return null;
  }

  const typedSession = session as StaffSessionRow;

  const { data: staffUser, error: staffError } = await admin
    .from('staff_users')
    .select('id, agency_id, team_member_id, display_name, is_active')
    .eq('id', typedSession.staff_user_id)
    .maybeSingle();

  const typedStaffUser = staffUser as StaffUserRow | null;

  if (staffError || !typedStaffUser || !typedStaffUser.is_active) {
    console.error('[upload_staff_lqs_sales] Staff user lookup failed:', staffError);
    return null;
  }

  return typedStaffUser;
}

async function processSalesUpload(
  admin: AdminClient,
  records: ParsedSaleRow[],
  context: SalesUploadContext,
): Promise<SalesUploadResult> {
  let householdsMatched = 0;
  let householdsCreated = 0;
  let salesCreated = 0;
  let quotesLinked = 0;
  let autoMatched = 0;
  let needsReview = 0;
  const pendingReviews: PendingSaleReview[] = [];
  const uploadedHouseholds: UploadedHouseholdInfo[] = [];
  const matchedTeamMemberIds = new Set<string>();
  let errorCount = 0;
  const householdsNeedingAttentionIds = new Set<string>();
  const unmatchedProducerSet = new Set<string>();
  const errors: string[] = [];

  const { data: teamMembers, error: tmError } = await admin
    .from('team_members')
    .select('id, name, sub_producer_code')
    .eq('agency_id', context.agencyId);

  if (tmError) {
    throw new Error(`Failed to fetch team members: ${tmError.message}`);
  }

  const teamMembersList = (teamMembers || []) as TeamMember[];
  const codeToMember = new Map<string, TeamMember>();
  for (const teamMember of teamMembersList) {
    if (teamMember.sub_producer_code) {
      codeToMember.set(teamMember.sub_producer_code.toLowerCase(), teamMember);
    }
  }

  const householdRecordsMap = new Map<string, ParsedSaleRow[]>();
  for (const record of records) {
    const householdKey = record.householdKey || generateHouseholdKey(
      record.firstName,
      record.lastName,
      record.zipCode,
    );
    const existing = householdRecordsMap.get(householdKey) || [];
    existing.push(record);
    householdRecordsMap.set(householdKey, existing);
  }

  const householdGroups = Array.from(householdRecordsMap.entries()).map(([householdKey, groupedRecords]) => ({
    householdKey,
    records: groupedRecords,
    primaryRecord: groupedRecords[0],
  }));

  const totalGroups = householdGroups.length;

  for (let batchStart = 0; batchStart < totalGroups; batchStart += BATCH_SIZE) {
    const batch = householdGroups.slice(batchStart, Math.min(batchStart + BATCH_SIZE, totalGroups));
    const batchResults: PromiseSettledResult<GroupUploadResult>[] = [];

    for (let groupStart = 0; groupStart < batch.length; groupStart += GROUP_CONCURRENCY_LIMIT) {
      const groupChunk = batch.slice(groupStart, groupStart + GROUP_CONCURRENCY_LIMIT);
      const chunkResults = await Promise.allSettled(
        groupChunk.map(async (group): Promise<GroupUploadResult> => {
          const { householdKey, records: groupRecords, primaryRecord } = group;
          const groupErrors: string[] = [];
          const addError = (record: ParsedSaleRow, detail: string) => {
            groupErrors.push(`${buildSaleErrorPrefix(record)} ${detail}`);
          };

          let teamMemberId: string | null = null;
          if (primaryRecord.subProducerCode) {
            const matched = codeToMember.get(primaryRecord.subProducerCode.toLowerCase());
            if (matched) teamMemberId = matched.id;
          }

          if (!teamMemberId && primaryRecord.subProducerName) {
            const matched = fuzzyMatchTeamMember(normalizeNameForMatch(primaryRecord.subProducerName), teamMembersList);
            if (matched) teamMemberId = matched.id;
          }

          if (!teamMemberId && primaryRecord.subProducerRaw) {
            unmatchedProducerSet.add(primaryRecord.subProducerRaw);
          }

          let householdId: string | null = null;
          let wasCreated = false;
          let householdFound = false;
          let needsAttentionFlag = false;
          let wasAutoMatched = false;
          let needsManualReview = false;
          let reviewCandidates: MatchCandidate[] = [];
          let policyMatchFound = false;

          if (primaryRecord.policyNumber) {
            const { data: matchingQuote, error: policyMatchError } = await admin
              .from('lqs_quotes')
              .select('household_id')
              .eq('agency_id', context.agencyId)
              .eq('issued_policy_number', primaryRecord.policyNumber)
              .maybeSingle();

            if (policyMatchError) {
              addError(primaryRecord, `could not check for a policy number match because LQS quote lookup failed: ${policyMatchError.message}`);
            }

            const matchedQuote = matchingQuote as MatchingQuoteHouseholdRow | null;

            if (matchedQuote?.household_id) {
              const matchedHouseholdId = matchedQuote.household_id;
              householdId = matchedHouseholdId;
              householdFound = true;
              policyMatchFound = true;
              wasAutoMatched = true;

              const { data: householdLookup, error: hhLookupError } = await admin
                .from('lqs_households')
                .select('lead_source_id')
                .eq('id', matchedHouseholdId)
                .single();

              if (hhLookupError) {
                addError(primaryRecord, `could not determine lead source for this customer because LQS lookup failed: ${hhLookupError.message}`);
              } else {
                needsAttentionFlag = !householdLookup?.lead_source_id;
              }
            }
          }

          if (!policyMatchFound) {
            const { data: existingHousehold, error: householdLookupError } = await admin
              .from('lqs_households')
              .select('id, status, lead_source_id')
              .eq('agency_id', context.agencyId)
              .eq('household_key', householdKey)
              .maybeSingle();

            if (householdLookupError) {
              addError(primaryRecord, `could not check existing customers because household lookup failed: ${householdLookupError.message}`);
            }

            const typedExistingHousehold = existingHousehold as { id: string; status: string; lead_source_id: string | null } | null;

            if (typedExistingHousehold) {
              householdId = typedExistingHousehold.id;
              householdFound = true;
              needsAttentionFlag = !typedExistingHousehold.lead_source_id;
              wasAutoMatched = true;
            } else {
              const { data: candidateHouseholdsData, error: candidateError } = await admin
                .from('lqs_households')
                .select('id, first_name, last_name, zip_code, lead_source_id, team_member_id')
                .eq('agency_id', context.agencyId)
                .ilike('last_name', primaryRecord.lastName);

              if (candidateError) {
                addError(primaryRecord, `could not search matching names in LQS because candidate lookup failed: ${candidateError.message}`);
              } else {
                const candidateHouseholds = (candidateHouseholdsData || []) as CandidateHouseholdBaseRow[];
                const candidateHouseholdIds = candidateHouseholds.map((household) => household.id);
                const quotesByHousehold = new Map<string, HouseholdWithQuotes['quotes']>();

                if (candidateHouseholdIds.length > 0) {
                  const { data: candidateQuotesData, error: candidateQuotesError } = await admin
                    .from('lqs_quotes')
                    .select('id, household_id, product_type, premium_cents, quote_date')
                    .in('household_id', candidateHouseholdIds);

                  if (candidateQuotesError) {
                    addError(primaryRecord, `could not load candidate quotes because quote lookup failed: ${candidateQuotesError.message}`);
                  } else {
                    for (const quote of (candidateQuotesData || []) as CandidateQuoteRow[]) {
                      const existingQuotes = quotesByHousehold.get(quote.household_id) || [];
                      existingQuotes.push({
                        id: quote.id,
                        product_type: quote.product_type,
                        premium_cents: quote.premium_cents,
                        quote_date: quote.quote_date,
                      });
                      quotesByHousehold.set(quote.household_id, existingQuotes);
                    }
                  }
                }

                const leadSourceIds = Array.from(new Set(
                  candidateHouseholds
                    .map((household) => household.lead_source_id)
                    .filter((value): value is string => typeof value === 'string' && value.length > 0),
                ));
                const leadSourceMap = new Map<string, string>();

                if (leadSourceIds.length > 0) {
                  const { data: leadSourceRows, error: leadSourceError } = await admin
                    .from('lead_sources')
                    .select('id, name')
                    .in('id', leadSourceIds);

                  if (leadSourceError) {
                    addError(primaryRecord, `could not load candidate lead sources because lead source lookup failed: ${leadSourceError.message}`);
                  } else {
                    for (const leadSource of (leadSourceRows || []) as LeadSourceRow[]) {
                      leadSourceMap.set(leadSource.id, leadSource.name);
                    }
                  }
                }

                const hydratedCandidates: HouseholdWithQuotes[] = candidateHouseholds.map((household) => ({
                  ...household,
                  quotes: quotesByHousehold.get(household.id) || [],
                  lead_source: household.lead_source_id
                    ? { name: leadSourceMap.get(household.lead_source_id) || 'Unknown lead source' }
                    : null,
                }));

                const nameMatchedCandidates = hydratedCandidates.filter((household) => {
                  const normSaleFirst = primaryRecord.firstName.toUpperCase().replace(/[^A-Z]/g, '');
                  const normHouseholdFirst = (household.first_name || '').toUpperCase().replace(/[^A-Z]/g, '');
                  if (normSaleFirst.length === 0 || normHouseholdFirst.length === 0) return false;
                  return normSaleFirst === normHouseholdFirst;
                });

                const scoredCandidates = nameMatchedCandidates
                  .map((household) => scoreCandidate(primaryRecord, household, teamMemberId))
                  .sort((a, b) => b.score - a.score)
                  .slice(0, 5);

                if (nameMatchedCandidates.length > 0) {
                  const autoMatchResult = shouldAutoMatch(scoredCandidates, `${primaryRecord.firstName} ${primaryRecord.lastName}`);

                  if (autoMatchResult.match) {
                    householdId = autoMatchResult.match.householdId;
                    householdFound = true;
                    wasAutoMatched = true;
                  } else {
                    needsManualReview = true;
                    reviewCandidates = scoredCandidates;

                    const { data: newHousehold, error: createError } = await admin
                      .from('lqs_households')
                      .insert({
                        agency_id: context.agencyId,
                        household_key: householdKey,
                        first_name: primaryRecord.firstName,
                        last_name: primaryRecord.lastName,
                        zip_code: primaryRecord.zipCode,
                        status: 'lead',
                        team_member_id: teamMemberId,
                        needs_attention: true,
                      })
                      .select('id')
                      .single();

                    if (createError) {
                      const { data: retryHousehold } = await admin
                        .from('lqs_households')
                        .select('id')
                        .eq('agency_id', context.agencyId)
                        .eq('household_key', householdKey)
                        .maybeSingle();

                      const typedRetryHousehold = retryHousehold as HouseholdIdLookupRow | null;
                      if (typedRetryHousehold) {
                        householdId = typedRetryHousehold.id;
                        householdFound = true;
                        wasCreated = true;
                        needsAttentionFlag = true;
                      } else {
                        addError(primaryRecord, `could not create this customer in LQS. Try again: ${createError.message}`);
                      }
                    } else {
                      householdId = (newHousehold as HouseholdIdLookupRow).id;
                      householdFound = true;
                      wasCreated = true;
                      needsAttentionFlag = true;
                    }
                  }
                } else {
                  const { data: newHousehold, error: createError } = await admin
                    .from('lqs_households')
                    .insert({
                      agency_id: context.agencyId,
                      household_key: householdKey,
                      first_name: primaryRecord.firstName,
                      last_name: primaryRecord.lastName,
                      zip_code: primaryRecord.zipCode,
                      status: 'lead',
                      team_member_id: teamMemberId,
                      needs_attention: true,
                    })
                    .select('id')
                    .single();

                  if (createError) {
                    const { data: retryHousehold } = await admin
                      .from('lqs_households')
                      .select('id')
                      .eq('agency_id', context.agencyId)
                      .eq('household_key', householdKey)
                      .maybeSingle();

                    const typedRetryHousehold = retryHousehold as HouseholdIdLookupRow | null;
                    if (typedRetryHousehold) {
                      householdId = typedRetryHousehold.id;
                      householdFound = true;
                      wasCreated = true;
                      needsAttentionFlag = true;
                    } else {
                      addError(primaryRecord, `could not create this customer in LQS. Try again: ${createError.message}`);
                    }
                  } else {
                    householdId = (newHousehold as HouseholdIdLookupRow).id;
                    householdFound = true;
                    wasCreated = true;
                    needsAttentionFlag = true;
                  }
                }
              }
            }
          }

          let groupContactId: string | null = null;
          if (householdId && primaryRecord.lastName?.trim()) {
            try {
              const { data: contactId } = await admin.rpc('find_or_create_contact', {
                p_agency_id: context.agencyId,
                p_first_name: primaryRecord.firstName || null,
                p_last_name: primaryRecord.lastName,
                p_zip_code: primaryRecord.zipCode || null,
                p_phone: null,
                p_email: null,
              });

              const resolvedContactId = typeof contactId === 'string' ? contactId : null;
              if (resolvedContactId) {
                groupContactId = resolvedContactId;
                await admin
                  .from('lqs_households')
                  .update({ contact_id: resolvedContactId })
                  .eq('id', householdId)
                  .is('contact_id', null);
              }
            } catch (contactError) {
              console.warn('[upload_staff_lqs_sales] Contact creation failed:', contactError);
            }
          }

          let salesCreatedInGroup = 0;
          let quotesLinkedInGroup = 0;
          let existingSalesForHousehold: ExistingLqsSale[] = [];
          let existingSalesForAgencyByPolicy: ExistingLqsSale[] = [];

          if (!householdId) {
            for (const record of groupRecords) {
              addError(record, 'could not be matched to a customer record, so this sale could not be saved.');
            }
          } else {
            const { data: existingSalesData, error: existingSalesError } = await admin
              .from('lqs_sales')
              .select('id, household_id, sale_date, product_type, premium_cents, policy_number')
              .eq('agency_id', context.agencyId)
              .eq('household_id', householdId);

            if (existingSalesError) {
              addError(primaryRecord, `could not check for duplicates because existing-sale lookup failed: ${existingSalesError.message}`);
            } else {
              existingSalesForHousehold = (existingSalesData || []) as ExistingLqsSale[];
            }

            const groupPolicyNumbers = Array.from(
              new Set(
                groupRecords
                  .map((record) => record.policyNumber?.trim())
                  .filter((value): value is string => !!value)
              )
            );

            if (groupPolicyNumbers.length > 0) {
              const { data: agencyPolicySalesData, error: agencyPolicySalesError } = await admin
                .from('lqs_sales')
                .select('id, household_id, sale_date, product_type, premium_cents, policy_number')
                .eq('agency_id', context.agencyId)
                .in('policy_number', groupPolicyNumbers);

              if (agencyPolicySalesError) {
                addError(primaryRecord, `could not check agency-wide policy duplicates because LQS lookup failed: ${agencyPolicySalesError.message}`);
              } else {
                existingSalesForAgencyByPolicy = (agencyPolicySalesData || []) as ExistingLqsSale[];
              }
            }

            for (const record of groupRecords) {
              let linkedQuoteId: string | null = null;

              const { data: matchingQuote, error: matchingQuoteError } = await admin
                .from('lqs_quotes')
                .select('id')
                .eq('household_id', householdId)
                .eq('product_type', record.productType)
                .order('quote_date', { ascending: false })
                .limit(1)
                .maybeSingle();

              if (matchingQuoteError) {
                addError(record, `could not verify matching quote details because LQS lookup failed: ${matchingQuoteError.message}`);
              } else if (matchingQuote) {
                linkedQuoteId = (matchingQuote as MatchingQuoteRow).id;
              }

              let saleTeamMemberId = teamMemberId;
              if (record.subProducerCode && record.subProducerCode !== primaryRecord.subProducerCode) {
                const matched = codeToMember.get(record.subProducerCode.toLowerCase());
                if (matched) saleTeamMemberId = matched.id;
              }

              const normalizedProduct = normalizeProductType(record.productType).toLowerCase();
              const hardDuplicate = existingSalesForHousehold.find((existing) =>
                isSamePolicyProduct(existing, record.policyNumber, record.productType)
              );

              if (hardDuplicate) {
                addError(record, 'was skipped as a duplicate (same policy number + product).');
                continue;
              }

              const crossHouseholdDuplicate = hasCrossHouseholdPolicyDuplicate(
                existingSalesForAgencyByPolicy,
                householdId,
                record.policyNumber,
                record.productType,
              );

              if (crossHouseholdDuplicate) {
                addError(record, 'was skipped as a duplicate because this policy number + product already exists in LQS under another customer record.');
                continue;
              }

              const likelyDuplicate = existingSalesForHousehold.find((existing) =>
                normalizeProductType(existing.product_type).toLowerCase() === normalizedProduct &&
                existing.sale_date === record.saleDate &&
                withinPremiumTolerance(record.premiumCents, existing.premium_cents, LIKELY_PREMIUM_TOLERANCE)
              );

              if (likelyDuplicate) {
                addError(record, 'was skipped as a likely duplicate (same day + product + similar premium).');
                continue;
              }

              const possibleDuplicate = existingSalesForHousehold.find((existing) =>
                normalizeProductType(existing.product_type).toLowerCase() === normalizedProduct &&
                dayDiffAbsolute(existing.sale_date, record.saleDate) <= POSSIBLE_DATE_WINDOW_DAYS &&
                withinPremiumTolerance(record.premiumCents, existing.premium_cents, POSSIBLE_PREMIUM_TOLERANCE)
              );

              const dedupeStatus = possibleDuplicate ? 'possible_duplicate' : 'new';
              const dedupeReason = possibleDuplicate
                ? 'Potential duplicate: nearby date + product + premium similarity'
                : null;

              let saleError: { code?: string; message?: string } | null = null;
              for (let attempt = 1; attempt <= 3; attempt++) {
                const { error: attemptError } = await admin
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
                    is_one_call_close: context.isOneCallClose ?? false,
                    raw_subproducer_code: record.subProducerCode || null,
                    raw_subproducer_name: record.subProducerName || null,
                    match_status: saleTeamMemberId ? 'matched' : 'unassigned',
                    dedupe_status: dedupeStatus,
                    dedupe_reason: dedupeReason,
                    dedupe_fingerprint: buildDedupeFingerprint(
                      context.agencyId,
                      householdId,
                      record.saleDate,
                      record.productType,
                      record.policyNumber,
                    ),
                  });

                saleError = attemptError;
                if (!saleError) break;
                if (!isRetryableDbError(saleError) || attempt === 3) break;
                await sleep(120 * attempt);
              }

              if (saleError) {
                const isDuplicate = saleError.code === '23505' || /duplicate/i.test(saleError.message || '');
                addError(record, isDuplicate ? 'already exists in LQS and was skipped.' : `was rejected by LQS: ${saleError.message}.`);
              } else {
                salesCreatedInGroup++;
                if (linkedQuoteId) {
                  quotesLinkedInGroup++;
                }
                existingSalesForHousehold.push({
                  id: `new-${record.rowNumber}-${record.saleDate}`,
                  household_id: householdId,
                  sale_date: record.saleDate,
                  product_type: record.productType,
                  premium_cents: record.premiumCents,
                  policy_number: record.policyNumber || null,
                });
              }
            }

            if (salesCreatedInGroup > 0) {
              const { data: currentHousehold } = await admin
                .from('lqs_households')
                .select('first_quote_date')
                .eq('id', householdId)
                .single();

              const householdUpdate: Record<string, unknown> = {
                status: 'sold',
                sold_date: primaryRecord.saleDate,
              };

              if (!currentHousehold?.first_quote_date) {
                householdUpdate.first_quote_date = primaryRecord.saleDate;
              }

              const { error: promoteError } = await admin
                .from('lqs_households')
                .update(householdUpdate)
                .eq('id', householdId);

              if (promoteError) {
                console.error(`[upload_staff_lqs_sales] Failed to promote household ${householdId}:`, promoteError);
              }
            }
          }

          return {
            matchedTeamMemberId: teamMemberId,
            wasCreated,
            householdFound,
            needsAttention: needsAttentionFlag,
            wasAutoMatched,
            needsManualReview,
            reviewCandidates,
            primaryRecord,
            salesCreatedInGroup,
            quotesLinkedInGroup,
            errors: groupErrors,
            householdId,
            contactId: groupContactId,
            customerName: `${primaryRecord.firstName} ${primaryRecord.lastName}`,
            customerZip: primaryRecord.zipCode,
            policiesInGroup: groupRecords.map((record) => ({
              productType: record.productType,
              policyNumber: record.policyNumber,
              premiumCents: record.premiumCents,
            })),
          };
        }),
      );

      batchResults.push(...chunkResults);
    }

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        const value = result.value;
        if (value.errors.length > 0) {
          errors.push(...value.errors);
          errorCount += value.errors.filter((message) => !isDuplicateSkipMessage(message)).length;
        }
        if (value.matchedTeamMemberId) matchedTeamMemberIds.add(value.matchedTeamMemberId);
        if (value.householdFound) {
          if (value.wasCreated) householdsCreated++;
          else householdsMatched++;
        }
        salesCreated += value.salesCreatedInGroup;
        quotesLinked += value.quotesLinkedInGroup;
        if (value.needsAttention && value.salesCreatedInGroup > 0 && value.householdId) {
          householdsNeedingAttentionIds.add(value.householdId);
        }
        if (value.wasAutoMatched) autoMatched++;
        if (value.needsManualReview) {
          needsReview++;
          pendingReviews.push({
            sale: value.primaryRecord,
            candidates: value.reviewCandidates,
          });
        }
        if (value.householdId && value.salesCreatedInGroup > 0) {
          uploadedHouseholds.push({
            householdId: value.householdId,
            contactId: value.contactId,
            customerName: value.customerName,
            customerZip: value.customerZip,
            policies: value.policiesInGroup,
          });
        }
      } else {
        errorCount++;
        errors.push(result.reason instanceof Error ? result.reason.message : 'Unknown error');
      }
    }
  }

  return {
    success: errorCount === 0,
    recordsProcessed: records.length,
    salesCreated,
    householdsMatched,
    householdsCreated,
    quotesLinked,
    teamMembersMatched: matchedTeamMemberIds.size,
    unmatchedProducers: Array.from(unmatchedProducerSet),
    householdsNeedingAttention: householdsNeedingAttentionIds.size,
    endorsementsSkipped: 0,
    errors,
    autoMatched,
    needsReview,
    pendingReviews,
    uploadedHouseholds,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  try {
    const sessionToken = req.headers.get('x-staff-session');
    if (!sessionToken) {
      return json(401, { error: 'Missing staff session token' });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const staffUser = await verifyStaffRequest(admin, sessionToken);
    if (!staffUser) {
      return json(401, { error: 'Invalid or expired staff session' });
    }

    const body = await req.json().catch(() => ({})) as {
      records?: ParsedSaleRow[];
      context?: SalesUploadContext;
    };

    const records = Array.isArray(body.records) ? body.records : [];
    if (records.length === 0) {
      return json(400, { error: 'No sales records provided' });
    }

    if (body.context?.agencyId && body.context.agencyId !== staffUser.agency_id) {
      return json(403, { error: 'Staff user is not authorized for the requested agency' });
    }

    const result = await processSalesUpload(admin, records, {
      agencyId: staffUser.agency_id,
      userId: staffUser.id,
      displayName: body.context?.displayName || staffUser.display_name || 'Staff',
      isOneCallClose: body.context?.isOneCallClose ?? false,
    });

    return json(200, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[upload_staff_lqs_sales] Fatal error:', error);
    return json(500, { error: message });
  }
});
