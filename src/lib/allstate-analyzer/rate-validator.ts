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
  
  // Get all text fields to search for patterns
  const searchText = [
    transaction.transType || '',
    transaction.product || '',
    transaction.policyBundleType || '',
    transaction.businessType || '',
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

function normalizeBundleType(bundleType: string): BundleType | 'Unknown' {
  const lower = bundleType.toLowerCase();
  if (lower.includes('prefer')) return 'Preferred';
  if (lower.includes('bundle')) return 'Bundled';
  if (lower.includes('mono')) return 'Monoline';
  return 'Unknown';
}

function determineBusinessType(businessType: string): 'New' | 'Renewal' | 'FirstRenewal' | 'Unknown' {
  const lower = businessType.toLowerCase().trim();
  
  // Check for first renewal
  if (lower.includes('first') && lower.includes('renewal')) {
    return 'FirstRenewal';
  }
  
  // Check for new business - exact patterns only
  if (lower === 'new business' || lower === 'new' || lower.startsWith('new ')) {
    return 'New';
  }
  
  // Check for renewal - but NOT if it says "new"
  if (lower.includes('renewal') && !lower.includes('new')) {
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
    const businessType = determineBusinessType(tx.businessType);
    const bundleType = normalizeBundleType(tx.policyBundleType);
    
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

    // Get actual rate from transaction
    const actualRate = tx.vcRate || 0;
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

  // Log potential underpayments for investigation
  if (potentialUnderpayments.length > 0) {
    console.log('\n🚨🚨🚨 POTENTIAL UNDERPAYMENTS TO INVESTIGATE 🚨🚨🚨');
    console.log('(These had 0% VC but no exclusion reason was detected)\n');
    
    potentialUnderpayments.slice(0, 10).forEach((d, i) => {
      console.log(`--- #${i + 1} ---`);
      console.log(`Policy: ${d.policyNumber}`);
      console.log(`Product: ${d.productRaw} → ${d.productCategory}`);
      console.log(`Type: ${d.businessType} | Bundle: ${d.bundleType}`);
      console.log(`Premium: $${d.writtenPremium.toLocaleString()}`);
      console.log(`Expected VC: ${(d.expectedVcRate * 100).toFixed(2)}% | Actual: ${(d.actualVcRate * 100).toFixed(2)}%`);
      console.log(`Missing VC: $${d.missingVcDollars.toFixed(2)}`);
      console.log('');
    });

    if (potentialUnderpayments.length > 10) {
      console.log(`... and ${potentialUnderpayments.length - 10} more potential underpayments`);
    }
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
