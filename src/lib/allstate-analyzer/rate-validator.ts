// src/lib/allstate-analyzer/rate-validator.ts

import { StatementTransaction } from '../allstate-parser/excel-parser';
import { getProductCategory, ProductCategory } from '../allstate-rates/product-mapping';
import {
  AAPLevel,
  BundleType,
  NO_VC_STATES,
  FLAT_RATE_STATES,
  DIFFERENT_HOME_STATES,
  NB_VC_RATES,
  RENEWAL_VC_RATES,
} from '../allstate-rates/constants';

export type ExclusionReason = 
  | 'NONE'
  | 'EXCLUDED_DIRECT_BOUND'
  | 'EXCLUDED_FIRST_RENEWAL_6MO'
  | 'EXCLUDED_SERVICE_FEE'
  | 'EXCLUDED_PLUS_POLICY'
  | 'EXCLUDED_NONSTANDARD_AUTO'
  | 'EXCLUDED_PRE_2023_POLICY'
  | 'EXCLUDED_JUA_JUP'
  | 'EXCLUDED_FACILITY_CEDED'
  | 'EXCLUDED_MONOLINE_RENEWAL'
  | 'EXCLUDED_NB_ITEM_ADDITION'
  | 'EXCLUDED_ENDORSEMENT_ADD_DROP'
  | 'UNKNOWN_EXCLUSION';

export interface RateDiscrepancy {
  policyNumber: string;
  rowNumber: number;
  transactionType: string;
  productRaw: string;
  productCategory: ProductCategory | null;
  businessType: 'New' | 'Renewal' | 'FirstRenewal' | 'Unknown';
  bundleType: 'Preferred' | 'Bundled' | 'Monoline' | 'Unknown';
  writtenPremium: number;
  actualVcRate: number;
  expectedVcRate: number;
  rateDifference: number;
  expectedNote: string;
  exclusionReason: ExclusionReason;
  exclusionNote: string;
  isPotentialUnderpayment: boolean;
  missingVcDollars: number;
}

export interface ValidationResult {
  total: number;
  analyzed: number;
  discrepancies: RateDiscrepancy[];
  potentialUnderpayments: RateDiscrepancy[];
  excludedTransactions: RateDiscrepancy[];
  exclusionBreakdown: Record<ExclusionReason, number>;
  totalMissingVcDollars: number;
  vcBaselineAchieved: boolean;
  state: string;
  aapLevel: string;
  // Legacy fields for backward compatibility
  summary: {
    totalTransactions: number;
    transactionsAnalyzed: number;
    discrepanciesFound: number;
    potentialUnderpaymentCents: number;
    potentialOverpaymentCents: number;
  };
  warnings: string[];
}

// Detection patterns for exclusion conditions
const DIRECT_BOUND_PATTERNS = [
  /\bCCC\b/i,
  /800-ALLSTATE/i,
  /1-800/i,
  /ALLSTATE\.COM/i,
  /WEB BOUND/i,
  /\bDIRECT\b/i,
  /\bONLINE\b/i,
  /AGENCY ROUTED/i,
  /CUSTOMER CONTACT/i,
];

const SERVICE_FEE_PATTERNS = [
  /SERVICE FEE/i,
  /SVC FEE/i,
  /SF POLICY/i,
  /SERV FEE/i,
];

const PLUS_POLICY_PATTERNS = [
  /PLUS POLICY/i,
  /PLUS POL/i,
];

const NON_STANDARD_AUTO_PATTERNS = [
  /NON-?STANDARD/i,
  /\bNSA\b/i,
  /NONSTANDARD/i,
  /\bENCOMPASS\b/i,
];

const JUA_JUP_PATTERNS = [
  /\bJUA\b/i,
  /\bJUP\b/i,
  /JOINT UNDERWRITING/i,
  /ASSIGNED RISK/i,
];

const FACILITY_PATTERNS = [
  /\bFACILITY\b/i,
  /\bCEDED\b/i,
];

function detectExclusionReason(
  transaction: StatementTransaction,
  businessType: string,
  productCategory: ProductCategory | null,
  bundleType: string
): { reason: ExclusionReason; note: string } {
  
  // CHECK 0: Endorsement Add/Drop transactions - add car/item premium is excluded from VC
  // Per Allstate: "The premium for an add car is excluded from variable compensation eligibility"
  const transType = String(transaction.transType || '').toLowerCase();
  if (transType.includes('endorsement')) {
    if (transType.includes('add item') || transType.includes('drop item') || 
        transType.includes('add coverage') || transType.includes('drop coverage') ||
        transType.includes('add premium') || transType.includes('drop premium')) {
      return {
        reason: 'EXCLUDED_ENDORSEMENT_ADD_DROP',
        note: 'Add item/drop item endorsement premium is excluded from variable compensation per Allstate rules'
      };
    }
  }

  // CHECK 1: Pre-2023 policies are not eligible for Variable Compensation
  // VC program only applies to policies with original effective date Jan 1, 2023 or later
  const origDateRaw = transaction.origPolicyEffDate || '';

  if (origDateRaw && origDateRaw !== 'N/A' && origDateRaw !== '' && origDateRaw !== '0') {
    const dateParts = String(origDateRaw).split('/');
    let origYear: number = 0;
    
    if (dateParts.length === 2) {
      // MM/YYYY format
      origYear = parseInt(dateParts[1], 10);
    } else if (dateParts.length === 3) {
      // MM/DD/YYYY format
      origYear = parseInt(dateParts[2], 10);
    }
    
    // If original policy is from before 2023, it's not eligible for VC
    if (origYear > 0 && origYear < 2023) {
      return {
        reason: 'EXCLUDED_PRE_2023_POLICY',
        note: `Policy original effective date (${origDateRaw}) is before Jan 1, 2023. Only policies written 1/1/2023 or later are eligible for Variable Compensation.`
      };
    }
  }

  // CHECK 1: Service Fee policy (from Service Fee Assigned Date field)
  const serviceFeeDate = transaction.serviceFeeAssignedDate || '';
  if (serviceFeeDate && serviceFeeDate.trim() !== '') {
    return {
      reason: 'EXCLUDED_SERVICE_FEE',
      note: `Service Fee policy (assigned ${serviceFeeDate}) - excluded from variable compensation`
    };
  }
  
  // CHECK 2: Channel - Direct/CCC/Web bound
  const channel = String(transaction.channel || '').toUpperCase();
  if (channel.includes('DIRECT') || channel.includes('CCC') || channel.includes('WEB') || 
      channel.includes('1-800') || channel.includes('ALLSTATE.COM') || channel.includes('ONLINE')) {
    return {
      reason: 'EXCLUDED_DIRECT_BOUND',
      note: `Policy bound via ${channel} - excluded from renewal VC per Allstate rules`
    };
  }
  
  // CHECK 3: Indicator field might contain exclusion info
  const indicator = String(transaction.indicator || '').toUpperCase();
  if (indicator.includes('SF') || indicator.includes('SERVICE FEE')) {
    return {
      reason: 'EXCLUDED_SERVICE_FEE',
      note: 'Service Fee indicator present - excluded from variable compensation'
    };
  }
  
  // CHECK 4: "New Business" item additions to existing policies
  // If Business Type is "New Business" but Orig. Policy Eff Date is > 6 months old,
  // this is an item addition to an existing policy, not a truly new policy.
  // These don't qualify for NB VC rates.
  if (businessType === 'New') {
    const origDate = transaction.origPolicyEffDate || '';
    
    if (origDate && origDate !== 'N/A' && origDate !== '') {
      // Parse the date (format is typically MM/YYYY or MM/DD/YYYY)
      const dateParts = String(origDate).split('/');
      let origMonth: number, origYear: number;
      
      if (dateParts.length === 2) {
        // MM/YYYY format
        origMonth = parseInt(dateParts[0], 10);
        origYear = parseInt(dateParts[1], 10);
      } else if (dateParts.length === 3) {
        // MM/DD/YYYY format
        origMonth = parseInt(dateParts[0], 10);
        origYear = parseInt(dateParts[2], 10);
      } else {
        origMonth = 0;
        origYear = 0;
      }
      
      // Get current date for comparison
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1; // 1-indexed
      
      // Calculate months difference
      const monthsDiff = (currentYear - origYear) * 12 + (currentMonth - origMonth);
      
      // If original policy is more than 6 months old, this is an item addition, not a new policy
      if (monthsDiff > 6 && origYear > 0) {
        return {
          reason: 'EXCLUDED_NB_ITEM_ADDITION',
          note: `Item added to existing policy (orig. ${origDate}). "New Business" label is for the item, not the policy. NB VC only applies to truly new policies.`
        };
      }
    }
  }
  
  // Get all text fields to search for patterns
  const searchText = [
    transaction.transType || '',
    transaction.product || '',
    transaction.policyBundleType || '',
    transaction.businessType || '',
    transaction.channel || '',
    transaction.indicator || '',
  ].join(' ').toUpperCase();

  // Check for Direct/CCC bound policies
  if (DIRECT_BOUND_PATTERNS.some(pattern => pattern.test(searchText))) {
    return {
      reason: 'EXCLUDED_DIRECT_BOUND',
      note: 'Policy bound via 1-800-Allstate or Allstate.com - excluded from renewal VC per Allstate rules'
    };
  }

  // Check for Service Fee policies
  if (SERVICE_FEE_PATTERNS.some(pattern => pattern.test(searchText))) {
    return {
      reason: 'EXCLUDED_SERVICE_FEE',
      note: 'Service Fee policy - excluded from variable compensation'
    };
  }

  // Check for Plus Policies
  if (PLUS_POLICY_PATTERNS.some(pattern => pattern.test(searchText))) {
    return {
      reason: 'EXCLUDED_PLUS_POLICY',
      note: 'Plus Policy - excluded from variable compensation'
    };
  }

  // Check for Non-Standard Auto
  if (NON_STANDARD_AUTO_PATTERNS.some(pattern => pattern.test(searchText))) {
    return {
      reason: 'EXCLUDED_NONSTANDARD_AUTO',
      note: 'Non-Standard Auto is excluded from variable compensation'
    };
  }

  // Check for JUA/JUP/Assigned Risk
  if (JUA_JUP_PATTERNS.some(pattern => pattern.test(searchText))) {
    return {
      reason: 'EXCLUDED_JUA_JUP',
      note: 'JUA/JUP/Assigned Risk policy - excluded from variable compensation'
    };
  }

  // Check for Facility ceded premium
  if (FACILITY_PATTERNS.some(pattern => pattern.test(searchText))) {
    return {
      reason: 'EXCLUDED_FACILITY_CEDED',
      note: 'Facility (ceded) premium - excluded from variable compensation'
    };
  }

  // Check for first renewal of 6-month auto policy
  if (businessType === 'FirstRenewal' && productCategory === 'StandardAuto') {
    return {
      reason: 'EXCLUDED_FIRST_RENEWAL_6MO',
      note: 'First renewal of 6-month auto - uses NB VC rates (Elite only if baseline achieved), not renewal VC rates'
    };
  }

  // Check for Monoline renewal (no VC on monoline renewals per Allstate rules)
  if (businessType === 'Renewal' && bundleType === 'Monoline') {
    return {
      reason: 'EXCLUDED_MONOLINE_RENEWAL',
      note: 'Monoline renewal policies do not receive renewal variable compensation - only Bundled and Preferred Bundled qualify'
    };
  }

  // No known exclusion found
  return { reason: 'NONE', note: '' };
}

// Helper: Determine bundle type from transaction
// CRITICAL: Parser uses 'policyBundleType' field - now accepts full tx object for flexibility
function normalizeBundleType(bundleTypeOrTx: string | any): BundleType | 'Unknown' {
  // Handle both string and full transaction object
  let bundleField: string;
  if (typeof bundleTypeOrTx === 'string') {
    bundleField = bundleTypeOrTx;
  } else {
    // Check all possible field names for bundle type
    bundleField = (
      bundleTypeOrTx?.policyBundleType ||
      bundleTypeOrTx?.bundleType || 
      bundleTypeOrTx?.bundleStatus || 
      bundleTypeOrTx?.bundle_type ||
      bundleTypeOrTx?.multiline || 
      bundleTypeOrTx?.householdStatus ||
      bundleTypeOrTx?.bundlingStatus ||
      ''
    );
  }
  
  if (!bundleField) return 'Unknown';
  const lower = String(bundleField).toLowerCase().trim();
  
  // Preferred Bundle = Auto + Home/Condo (highest tier)
  if (lower === 'preferred' || lower.includes('prefer') || 
      lower.includes('auto+home') || lower.includes('auto & home')) {
    return 'Preferred';
  }
  
  // Regular Bundle = 2+ products but not Auto+Home
  if (lower === 'bundled' || lower === 'bundle' ||
      lower.includes('bundle') || lower.includes('multi') || 
      lower.includes('2+')) {
    return 'Bundled';
  }
  
  // Monoline = single product
  if (lower === 'monoline' || lower === 'mono' ||
      lower.includes('mono') || lower.includes('single')) {
    return 'Monoline';
  }
  
  return 'Unknown';
}

// Helper: Determine business type from transaction
// CRITICAL: Check tx.businessType FIRST - it's the authoritative source from Allstate
function determineBusinessType(tx: any): 'New' | 'Renewal' | 'FirstRenewal' | 'Unknown' {
  // Get the businessType field - this is the authoritative source from Allstate
  const rawBusinessType = tx.businessType || tx.business_type || tx.BusinessType || '';
  const normalizedType = String(rawBusinessType).toLowerCase().trim();
  
  // EXACT MATCH for common values (most reliable)
  if (normalizedType === 'renewal') {
    return 'Renewal';
  }
  
  if (normalizedType === 'new business' || normalizedType === 'new' || normalizedType === 'newbusiness') {
    return 'New';
  }
  
  if (normalizedType === 'first renewal' || normalizedType === 'firstrenewal') {
    return 'FirstRenewal';
  }
  
  // CONTAINS check for variations
  if (normalizedType.includes('first') && normalizedType.includes('renewal')) {
    return 'FirstRenewal';
  }
  
  if (normalizedType.includes('renewal')) {
    return 'Renewal';
  }
  
  if (normalizedType.includes('new')) {
    return 'New';
  }
  
  // FALLBACK: Check transaction type if businessType field is empty
  const transType = String(tx.transType || tx.transactionType || tx.trans_type || '').toLowerCase();
  
  if (transType.includes('new business') || transType.includes('new policy')) {
    return 'New';
  }
  
  if (transType.includes('renewal')) {
    return 'Renewal';
  }
  
  return 'Unknown';
}

function getExpectedVCRate(
  product: string,
  businessType: 'New' | 'Renewal' | 'FirstRenewal' | 'Unknown',
  bundleType: BundleType | 'Unknown',
  state: string,
  aapLevel: AAPLevel,
  vcBaselineAchieved: boolean,
  productCategory: ProductCategory | null
): { rate: number; note: string } {
  // Check if state has no VC
  if (NO_VC_STATES.includes(state)) {
    return { rate: 0, note: 'No variable compensation in this state' };
  }
  
  // If VC baseline not achieved, no VC expected
  if (!vcBaselineAchieved) {
    return { rate: 0, note: 'VC baseline not achieved - no variable compensation expected' };
  }
  
  // No rate if product not categorized or excluded
  if (!productCategory || productCategory === 'Excluded') {
    return { rate: 0, note: 'Product may not be eligible for variable compensation' };
  }
  
  // Can't determine rate without bundle type
  if (bundleType === 'Unknown') {
    return { rate: 0, note: 'Could not determine bundle type from statement' };
  }

  // Monoline renewals get 0% VC per Allstate rules
  if (businessType === 'Renewal' && bundleType === 'Monoline') {
    return { rate: 0, note: 'Monoline renewals do not receive variable compensation' };
  }
  
  const validCategory = productCategory as Exclude<ProductCategory, 'Excluded'>;
  
  if (businessType === 'New' || businessType === 'FirstRenewal') {
    // New Business VC rates (also used for first renewal for Elite)
    let rateTable: typeof NB_VC_RATES.countrywide;
    if (FLAT_RATE_STATES.includes(state)) {
      rateTable = NB_VC_RATES.flat;
    } else if (DIFFERENT_HOME_STATES.includes(state)) {
      rateTable = NB_VC_RATES.txla;
    } else {
      rateTable = NB_VC_RATES.countrywide;
    }
    
    const rate = rateTable[validCategory]?.[bundleType] ?? 0;
    const typeLabel = businessType === 'FirstRenewal' ? 'First Renewal (NB rates)' : 'New Business';
    return { rate, note: `${typeLabel} ${bundleType} rate for ${validCategory}` };
  } else if (businessType === 'Renewal') {
    // Renewal VC rates
    if (FLAT_RATE_STATES.includes(state)) {
      const flatRates = RENEWAL_VC_RATES.flat[aapLevel];
      const rate = flatRates[validCategory] ?? 0;
      return { rate, note: `Renewal flat rate for ${aapLevel} in ${state}` };
    } else {
      const countryRates = RENEWAL_VC_RATES.countrywide[aapLevel];
      const categoryRates = countryRates[validCategory];
      
      // Renewal rates only apply to Preferred and Bundled, not Monoline
      if (bundleType === 'Monoline') {
        return { rate: 0, note: 'Monoline renewals do not receive variable compensation' };
      }
      const rate = categoryRates?.[bundleType as 'Preferred' | 'Bundled'] ?? 0;
      return { rate, note: `Renewal ${bundleType} rate for ${aapLevel} ${validCategory}` };
    }
  }
  
  return { rate: 0, note: 'Could not determine business type' };
}

export function validateRates(
  transactions: StatementTransaction[],
  state: string,
  aapLevel: AAPLevel,
  vcBaselineAchieved: boolean
): ValidationResult {
  const discrepancies: RateDiscrepancy[] = [];
  const warnings: string[] = [];
  
  const exclusionBreakdown: Record<ExclusionReason, number> = {
    'NONE': 0,
    'EXCLUDED_DIRECT_BOUND': 0,
    'EXCLUDED_FIRST_RENEWAL_6MO': 0,
    'EXCLUDED_SERVICE_FEE': 0,
    'EXCLUDED_PLUS_POLICY': 0,
    'EXCLUDED_NONSTANDARD_AUTO': 0,
    'EXCLUDED_PRE_2023_POLICY': 0,
    'EXCLUDED_JUA_JUP': 0,
    'EXCLUDED_FACILITY_CEDED': 0,
    'EXCLUDED_MONOLINE_RENEWAL': 0,
    'EXCLUDED_NB_ITEM_ADDITION': 0,
    'EXCLUDED_ENDORSEMENT_ADD_DROP': 0,
    'UNKNOWN_EXCLUSION': 0,
  };

  let analyzed = 0;
  let totalMissingVcDollars = 0;

  // Rate threshold for flagging discrepancies (0.5%)
  const RATE_THRESHOLD = 0.005;

  for (const tx of transactions) {
    // Skip transactions with no premium or negative premium
    if (!tx.writtenPremium || tx.writtenPremium <= 0) continue;
    
    // Skip non-VC eligible transaction types
    const transType = (tx.transType || '').toLowerCase();
    if (transType.includes('chargeback') || transType.includes('adjustment')) continue;

    analyzed++;

    const productMapping = getProductCategory(tx.product);
    const productCategory = productMapping.vcEligible ? productMapping.category : null;
    const businessType = determineBusinessType(tx);
    const bundleType = normalizeBundleType(tx);
    
    // DEBUG: Log first 5 transactions to verify detection
    if (analyzed <= 5) {
      console.log(`[DEBUG] Transaction ${analyzed}:`, {
        policy: tx.policyNumber,
        rawBusinessType: tx.businessType,
        detectedBusinessType: businessType,
        rawBundleType: tx.policyBundleType,
        detectedBundleType: bundleType,
        rawVcRate: tx.vcRate,
      });
    }
    
    // Get expected rate
    const expected = getExpectedVCRate(
      tx.product,
      businessType,
      bundleType,
      state,
      aapLevel,
      vcBaselineAchieved,
      productCategory
    );

    // Get actual rate from transaction - check multiple possible field names
    const actualRate = tx.vcRate ?? 0;
    const rateDiff = actualRate - expected.rate;

    // Check if there's a discrepancy (expected VC but got less)
    const hasDiscrepancy = expected.rate > 0 && rateDiff < -RATE_THRESHOLD;

    if (hasDiscrepancy) {
      // Check for exclusion reasons
      const { reason, note } = detectExclusionReason(
        tx,
        businessType,
        productCategory,
        bundleType
      );

      const isPotentialUnderpayment = reason === 'NONE';
      const finalReason = reason === 'NONE' ? 'UNKNOWN_EXCLUSION' : reason;
      const finalNote = reason === 'NONE' 
        ? 'No exclusion reason detected - POTENTIAL UNDERPAYMENT. Verify channel of bind and policy type in source data.'
        : note;

      exclusionBreakdown[finalReason]++;

      const missingVcDollars = (expected.rate - actualRate) * tx.writtenPremium;
      
      if (isPotentialUnderpayment) {
        totalMissingVcDollars += missingVcDollars;
      }

      discrepancies.push({
        policyNumber: tx.policyNumber || 'Unknown',
        rowNumber: tx.rowNumber,
        transactionType: tx.transType || 'Unknown',
        productRaw: tx.product || 'Unknown',
        productCategory,
        businessType,
        bundleType,
        writtenPremium: tx.writtenPremium,
        actualVcRate: actualRate,
        expectedVcRate: expected.rate,
        rateDifference: rateDiff,
        expectedNote: expected.note,
        exclusionReason: finalReason,
        exclusionNote: finalNote,
        isPotentialUnderpayment,
        missingVcDollars,
      });
    }
  }

  // Separate potential underpayments from excluded transactions
  const potentialUnderpayments = discrepancies.filter(d => d.isPotentialUnderpayment);
  const excludedTransactions = discrepancies.filter(d => !d.isPotentialUnderpayment);

  // Log summary
  console.log('\n========================================');
  console.log('[RateValidator] ANALYSIS COMPLETE');
  console.log('========================================');
  console.log(`Total Transactions: ${transactions.length}`);
  console.log(`Analyzed: ${analyzed}`);
  console.log(`Total Discrepancies: ${discrepancies.length}`);
  console.log(`-----------------------------------------`);
  console.log(`🚨 POTENTIAL UNDERPAYMENTS: ${potentialUnderpayments.length}`);
  console.log(`✓ Legitimately Excluded: ${excludedTransactions.length}`);
  console.log(`💰 Total Missing VC (potential): $${totalMissingVcDollars.toFixed(2)}`);
  console.log(`-----------------------------------------`);
  console.log(`State: ${state} | AAP Level: ${aapLevel}`);
  console.log(`VC Baseline Achieved: ${vcBaselineAchieved}`);
  console.log('========================================\n');

  console.log('[RateValidator] EXCLUSION BREAKDOWN:');
  Object.entries(exclusionBreakdown).forEach(([reason, count]) => {
    if (count > 0) {
      const icon = reason === 'UNKNOWN_EXCLUSION' ? '🚨' : '✓';
      console.log(`  ${icon} ${reason}: ${count}`);
    }
  });

  // Log potential underpayments for investigation with RAW DATA
  if (potentialUnderpayments.length > 0) {
    console.log('\n🚨🚨🚨 POTENTIAL UNDERPAYMENTS TO INVESTIGATE 🚨🚨🚨');
    console.log('(These had 0% VC but no exclusion reason was detected)\n');
    
    potentialUnderpayments.slice(0, 10).forEach((d, i) => {
      // Find matching raw transaction BY ROW NUMBER (not just policy)
      const rawTx = transactions.find(tx => tx.rowNumber === d.rowNumber);
      
      console.log(`--- #${i + 1} ---`);
      console.log(`Row: ${d.rowNumber}`);
      console.log(`Policy: ${d.policyNumber}`);
      console.log(`Product: ${d.productRaw} → ${d.productCategory}`);
      console.log(`Type: ${d.businessType} | Bundle: ${d.bundleType}`);
      console.log(`Premium: $${d.writtenPremium.toLocaleString()}`);
      console.log(`Expected VC: ${(d.expectedVcRate * 100).toFixed(2)}% | Actual: ${(d.actualVcRate * 100).toFixed(2)}%`);
      console.log(`Missing VC: $${d.missingVcDollars.toFixed(2)}`);
      
      // Show RAW transaction fields for debugging
      if (rawTx) {
        console.log('--- RAW DATA (same row) ---');
        console.log(`  transType: "${rawTx.transType}"`);
        console.log(`  businessType: "${rawTx.businessType}"`);
        console.log(`  policyBundleType: "${rawTx.policyBundleType}"`);
        console.log(`  channel: "${rawTx.channel || 'N/A'}"`);
        console.log(`  serviceFeeAssignedDate: "${rawTx.serviceFeeAssignedDate || 'N/A'}"`);
        console.log(`  indicator: "${rawTx.indicator || 'N/A'}"`);
        console.log(`  origPolicyEffDate: "${rawTx.origPolicyEffDate || 'N/A'}"`);
        console.log(`  vcRate (raw): ${rawTx.vcRate}`);
        console.log(`  vcAmount (raw): ${rawTx.vcAmount}`);
      }
      console.log('');
    });

    if (potentialUnderpayments.length > 10) {
      console.log(`... and ${potentialUnderpayments.length - 10} more potential underpayments`);
    }
    
    // Summary of business types in underpayments
    const businessTypeCounts: Record<string, number> = {};
    const bundleTypeCounts: Record<string, number> = {};
    potentialUnderpayments.forEach(d => {
      businessTypeCounts[d.businessType] = (businessTypeCounts[d.businessType] || 0) + 1;
      bundleTypeCounts[d.bundleType] = (bundleTypeCounts[d.bundleType] || 0) + 1;
    });
    
    console.log('\n📊 UNDERPAYMENT BREAKDOWN:');
    console.log('By Business Type:', businessTypeCounts);
    console.log('By Bundle Type:', bundleTypeCounts);
  }

  // Add warnings for common issues
  if (discrepancies.length > transactions.length * 0.5) {
    warnings.push('A large percentage of transactions show rate differences. Column mapping may need adjustment.');
  }

  // Calculate legacy fields for backward compatibility
  const potentialUnderpaymentCents = Math.round(totalMissingVcDollars * 100);

  return {
    total: transactions.length,
    analyzed,
    discrepancies,
    potentialUnderpayments,
    excludedTransactions,
    exclusionBreakdown,
    totalMissingVcDollars,
    vcBaselineAchieved,
    state,
    aapLevel,
    // Legacy fields
    summary: {
      totalTransactions: transactions.length,
      transactionsAnalyzed: analyzed,
      discrepanciesFound: potentialUnderpayments.length, // Only count actual underpayments
      potentialUnderpaymentCents,
      potentialOverpaymentCents: 0,
    },
    warnings,
  };
}
