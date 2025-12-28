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

export interface RateDiscrepancy {
  transaction: {
    rowNumber: number;
    policyNumber: string;
    product: string;
    businessType: string;
    bundleType: string;
    writtenPremium: number;
  };
  expectedRate: number;
  actualRate: number;
  rateDifference: number;
  potentialImpactCents: number;
  confidence: 'high' | 'medium' | 'low';
  note: string;
}

export interface ValidationResult {
  discrepancies: RateDiscrepancy[];
  summary: {
    totalTransactions: number;
    transactionsAnalyzed: number;
    discrepanciesFound: number;
    potentialUnderpaymentCents: number;
    potentialOverpaymentCents: number;
  };
  warnings: string[];
}

function normalizeBundleType(bundleType: string): BundleType | null {
  const lower = bundleType.toLowerCase();
  if (lower.includes('prefer')) return 'Preferred';
  if (lower.includes('bundle')) return 'Bundled';
  if (lower.includes('mono')) return 'Monoline';
  return null;
}

function isNewBusiness(businessType: string): boolean {
  const lower = businessType.toLowerCase();
  return lower.includes('new') || lower.includes('nb');
}

function isFirstRenewal(businessType: string): boolean {
  const lower = businessType.toLowerCase();
  return lower.includes('first') && lower.includes('renewal');
}

function getNBRateTable(state: string): typeof NB_VC_RATES.countrywide {
  if (FLAT_RATE_STATES.includes(state)) {
    return NB_VC_RATES.flat;
  } else if (DIFFERENT_HOME_STATES.includes(state)) {
    return NB_VC_RATES.txla;
  } else {
    return NB_VC_RATES.countrywide;
  }
}

function getExpectedVCRate(
  product: string,
  businessType: string,
  bundleType: string,
  state: string,
  aapLevel: AAPLevel,
  vcBaselineAchieved: boolean
): { rate: number; confidence: 'high' | 'medium' | 'low'; note: string } {
  // Check if state has no VC
  if (NO_VC_STATES.includes(state)) {
    return { rate: 0, confidence: 'high', note: 'No variable compensation in this state' };
  }
  
  // If VC baseline not achieved, no VC expected
  if (!vcBaselineAchieved) {
    return { rate: 0, confidence: 'high', note: 'VC baseline not achieved - no variable compensation expected' };
  }
  
  const productMapping = getProductCategory(product);
  if (!productMapping.vcEligible || productMapping.category === 'Excluded') {
    return { rate: 0, confidence: 'medium', note: 'Product may not be eligible for variable compensation' };
  }
  
  const bundle = normalizeBundleType(bundleType);
  if (!bundle) {
    return { rate: 0, confidence: 'low', note: 'Could not determine bundle type from statement' };
  }
  
  const category = productMapping.category as Exclude<ProductCategory, 'Excluded'>;
  const isNB = isNewBusiness(businessType);
  const isFirstRen = isFirstRenewal(businessType);
  
  if (isNB) {
    // New Business VC rates
    const rateTable = getNBRateTable(state);
    const rate = rateTable[category]?.[bundle] ?? 0;
    return { rate, confidence: 'high', note: `New Business ${bundle} rate for ${category}` };
  } else if (isFirstRen) {
    // First Renewal on 6-month auto: Elite gets NB rates, Pro/Emerging get 0%
    if (aapLevel === 'Elite') {
      // Elite gets NB-level VC on first renewal
      const rateTable = getNBRateTable(state);
      const rate = rateTable[category]?.[bundle] ?? 0;
      return { rate, confidence: 'high', note: `First Renewal - Elite agents receive NB-level VC` };
    } else {
      // Pro and Emerging get 0% on first renewal of 6-month policies
      return { rate: 0, confidence: 'medium', note: `First Renewal - ${aapLevel} agents typically receive no VC on first renewal of 6-month policies` };
    }
  } else {
    // Regular Renewal VC rates
    if (FLAT_RATE_STATES.includes(state)) {
      const flatRates = RENEWAL_VC_RATES.flat[aapLevel];
      const rate = flatRates[category] ?? 0;
      return { rate, confidence: 'high', note: `Renewal flat rate for ${aapLevel} in ${state}` };
    } else {
      const countryRates = RENEWAL_VC_RATES.countrywide[aapLevel];
      const categoryRates = countryRates[category];
      // Renewal rates only apply to Preferred and Bundled, not Monoline
      if (bundle === 'Monoline') {
        return { rate: 0, confidence: 'high', note: 'Monoline renewals do not receive variable compensation' };
      }
      const rate = categoryRates?.[bundle as 'Preferred' | 'Bundled'] ?? 0;
      return { rate, confidence: 'high', note: `Renewal ${bundle} rate for ${aapLevel} ${category}` };
    }
  }
}

export function validateRates(
  transactions: StatementTransaction[],
  state: string,
  aapLevel: AAPLevel,
  vcBaselineAchieved: boolean
): ValidationResult {
  const discrepancies: RateDiscrepancy[] = [];
  const warnings: string[] = [];
  let analyzed = 0;
  let potentialUnder = 0;
  let potentialOver = 0;
  
  // Threshold for flagging - 0.5% rate difference
  const RATE_THRESHOLD = 0.005;
  
  // Debug counter for first few discrepancies
  let debugCount = 0;
  
  for (const tx of transactions) {
    // Skip if no premium (likely a memo or adjustment row)
    if (tx.writtenPremium === 0) continue;
    
    analyzed++;
    
    const productMapping = getProductCategory(tx.product);
    
    // Debug: log product mapping for first 5 transactions
    if (debugCount < 5) {
      console.log('[ProductMapping]', tx.product, '->', productMapping.category);
    }
    
    const expected = getExpectedVCRate(
      tx.product,
      tx.businessType,
      tx.policyBundleType,
      state,
      aapLevel,
      vcBaselineAchieved
    );
    
    const rateDiff = tx.vcRate - expected.rate;
    const impactCents = Math.round(rateDiff * tx.writtenPremium * 100);
    
    // Only flag if difference exceeds threshold
    if (Math.abs(rateDiff) > RATE_THRESHOLD) {
      // Debug logging for first 5 discrepancies - separate logs to avoid truncation
      if (debugCount < 5) {
        console.log('=== DISCREPANCY #' + (debugCount + 1) + ' ===');
        console.log('Policy:', tx.policyNumber);
        console.log('Product (raw):', tx.product);
        console.log('Product Category:', productMapping.category);
        console.log('Business Type:', tx.businessType);
        console.log('Bundle Type:', tx.policyBundleType);
        console.log('ACTUAL VC Rate:', tx.vcRate);
        console.log('EXPECTED VC Rate:', expected.rate);
        console.log('Rate Diff:', rateDiff);
        console.log('Expected Note:', expected.note);
        console.log('========================');
        debugCount++;
      }
      
      discrepancies.push({
        transaction: {
          rowNumber: tx.rowNumber,
          policyNumber: tx.policyNumber,
          product: tx.product,
          businessType: tx.businessType,
          bundleType: tx.policyBundleType,
          writtenPremium: tx.writtenPremium,
        },
        expectedRate: expected.rate,
        actualRate: tx.vcRate,
        rateDifference: rateDiff,
        potentialImpactCents: impactCents,
        confidence: expected.confidence,
        note: rateDiff < 0
          ? `Rate may be lower than expected. ${expected.note}. This may warrant review.`
          : `Rate appears higher than expected. ${expected.note}. This is unusual but may be correct.`,
      });
      
      if (impactCents < 0) {
        potentialUnder += Math.abs(impactCents);
      } else {
        potentialOver += impactCents;
      }
    }
  }
  
  // Debug summary
  console.log('[RateValidator] Summary:', {
    total: transactions.length,
    analyzed,
    discrepancies: discrepancies.length,
    vcBaselineAchieved,
    state,
    aapLevel
  });
  
  if (discrepancies.length > transactions.length * 0.5) {
    warnings.push('A large percentage of transactions show rate differences. Column mapping may need adjustment.');
  }
  
  return {
    discrepancies,
    summary: {
      totalTransactions: transactions.length,
      transactionsAnalyzed: analyzed,
      discrepanciesFound: discrepancies.length,
      potentialUnderpaymentCents: potentialUnder,
      potentialOverpaymentCents: potentialOver,
    },
    warnings,
  };
}
