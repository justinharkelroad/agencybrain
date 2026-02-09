// Core payout calculation logic

import { CompPlan, CompPlanTier, BundleConfigs, BundleTypeConfig, ProductRates, PointValues, BundlingMultipliers, CommissionModifiers } from "@/hooks/useCompPlans";
import { SubProducerMetrics, SubProducerTransaction, BundleTypeBreakdown, ProductBreakdown } from "@/lib/allstate-analyzer/sub-producer-analyzer";
import {
  PayoutCalculation,
  TierMatch,
  SubProducerPerformance,
  AchievedPromo,
  SelfGenRequirement,
  SelfGenBonus,
  SelfGenPenaltyResult,
  SelfGenBonusResult,
  ChargebackDetail,
  ChargebackFilterResult,
  CalculationSnapshot,
  WrittenMetrics,
  BrokeredBundlingMetrics
} from "./types";
import { SelfGenMetrics } from "./self-gen";
import { supabase } from "@/integrations/supabase/client";
import { calculatePromoProgress, PromoGoal } from "@/hooks/usePromoGoals";

interface TeamMember {
  id: string;
  name: string;
  sub_producer_code: string | null;
}

interface Assignment {
  team_member_id: string;
  comp_plan_id: string;
}

// Manual override interface for testing compensation calculations
export interface ManualOverride {
  subProdCode: string;
  teamMemberId: string | null;
  teamMemberName: string | null;
  // Total metrics (for tier qualification)
  writtenItems: number | null;
  writtenPremium: number | null;
  writtenPolicies: number | null;
  writtenHouseholds: number | null;
  writtenPoints: number | null;
  // Bundle breakdown (for commission calculation)
  bundledItems: number | null;
  bundledPremium: number | null;
  monolineItems: number | null;
  monolinePremium: number | null;
}

/**
 * Parse a date string that could be in various formats
 */
function parseTransactionDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  
  try {
    const parts = String(dateStr).split('/');
    if (parts.length === 2) {
      // MM/YYYY format
      const month = parseInt(parts[0], 10) - 1;
      const year = parseInt(parts[1], 10);
      return new Date(year, month, 1);
    } else if (parts.length === 3) {
      // MM/DD/YYYY format
      const month = parseInt(parts[0], 10) - 1;
      const day = parseInt(parts[1], 10);
      const year = parseInt(parts[2], 10);
      return new Date(year, month, day);
    }
    // Try direct parsing
    const parsed = new Date(dateStr);
    return isNaN(parsed.getTime()) ? null : parsed;
  } catch {
    return null;
  }
}

function normalizeBundleTypeKey(bundleType: string): string {
  const normalized = (bundleType || '').trim().toLowerCase();
  if (!normalized || normalized === 'mono' || normalized === 'mono line' || normalized === 'monoline') return 'monoline';
  if (normalized === 'bundled' || normalized === 'standard' || normalized === 'std' || normalized === 'standard bundle') return 'standard';
  if (normalized === 'preferred' || normalized === 'pref' || normalized === 'preferred bundle') return 'preferred';
  return normalized;
}

function normalizeProductKey(product: string): string {
  return (product || '').trim().toLowerCase();
}

/**
 * Filter chargebacks based on the 3-month rule (90 days)
 * Only includes chargebacks where the policy was in force for less than 90 days
 */
export function filterChargebacksByThreeMonthRule(
  chargebackTransactions: SubProducerTransaction[],
  statementMonth: number,
  statementYear: number
): {
  eligibleChargebacks: SubProducerTransaction[];
  excludedChargebacks: SubProducerTransaction[];
  eligiblePremium: number;
  excludedPremium: number;
} {
  // Use the statement date as reference for calculating days in force
  const statementDate = new Date(statementYear, statementMonth - 1, 28); // End of statement month
  
  const eligibleChargebacks: SubProducerTransaction[] = [];
  const excludedChargebacks: SubProducerTransaction[] = [];
  
  for (const cb of chargebackTransactions) {
    const effectiveDate = parseTransactionDate(cb.origPolicyEffDate);
    
    if (!effectiveDate) {
      // If we can't parse the date, include the chargeback (conservative approach)
      eligibleChargebacks.push(cb);
      continue;
    }
    
    // Calculate days in force
    const daysInForce = Math.floor(
      (statementDate.getTime() - effectiveDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    if (daysInForce < 90) {
      // Policy cancelled within 90 days - chargeback applies
      eligibleChargebacks.push(cb);
    } else {
      // Policy was in force > 90 days - chargeback excluded
      excludedChargebacks.push(cb);
    }
  }
  
  const eligiblePremium = eligibleChargebacks.reduce((sum, cb) => sum + Math.abs(cb.premium), 0);
  const excludedPremium = excludedChargebacks.reduce((sum, cb) => sum + Math.abs(cb.premium), 0);
  
  return {
    eligibleChargebacks,
    excludedChargebacks,
    eligiblePremium,
    excludedPremium,
  };
}

/**
 * Filter chargebacks based on configurable rule (none, three_month, full)
 * Full-term uses product-specific term months (Auto=6mo, Home/Other=12mo)
 */
export function filterChargebacksByRule(
  chargebackTransactions: SubProducerTransaction[],
  chargebackRule: 'none' | 'three_month' | 'full',
  statementMonth: number,
  statementYear: number,
  productTermMonths: Map<string, number> // product type name -> term months
): ChargebackFilterResult {
  const statementDate = new Date(statementYear, statementMonth, 0);

  const result: ChargebackFilterResult = {
    eligibleChargebacks: [],
    excludedChargebacks: [],
    eligiblePremium: 0,
    excludedPremium: 0,
    details: [],
  };

  if (chargebackRule === 'none') {
    result.excludedChargebacks = chargebackTransactions;
    for (const cb of chargebackTransactions) {
      const premium = Math.abs(cb.premium || 0);
      result.excludedPremium += premium;
      result.details.push({
        policyNumber: cb.policyNumber || 'Unknown',
        productType: cb.product || 'Unknown',
        premium,
        daysInForce: 0,
        termMonths: 0,
        included: false,
        reason: 'Chargeback rule: none',
      });
    }
    return result;
  }

  for (const cb of chargebackTransactions) {
    const effectiveDate = parseTransactionDate(cb.origPolicyEffDate);
    const premium = Math.abs(cb.premium || 0);
    const productType = (cb.product || '').toLowerCase();

    if (!effectiveDate) {
      // Conservative: include if can't parse
      result.eligibleChargebacks.push(cb);
      result.eligiblePremium += premium;
      result.details.push({
        policyNumber: cb.policyNumber || 'Unknown',
        productType: cb.product || 'Unknown',
        premium,
        daysInForce: -1,
        termMonths: -1,
        included: true,
        reason: 'Could not parse effective date',
      });
      continue;
    }

    const daysInForce = Math.floor(
      (statementDate.getTime() - effectiveDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    let termMonths: number;
    let termEndDate: Date;

    if (chargebackRule === 'three_month') {
      termMonths = 3;
      termEndDate = new Date(
        effectiveDate.getFullYear(),
        effectiveDate.getMonth() + 3,
        0
      );
    } else {
      // Full term - lookup by product type
      termMonths = productTermMonths.get(productType) ||
        (productType.includes('auto') && !productType.includes('specialty') ? 6 : 12);
      termEndDate = new Date(
        effectiveDate.getFullYear(),
        effectiveDate.getMonth() + termMonths,
        0
      );
    }

    const included = statementDate <= termEndDate;

    if (included) {
      result.eligibleChargebacks.push(cb);
      result.eligiblePremium += premium;
    } else {
      result.excludedChargebacks.push(cb);
      result.excludedPremium += premium;
    }

    result.details.push({
      policyNumber: cb.policyNumber || 'Unknown',
      productType: cb.product || 'Unknown',
      premium,
      daysInForce,
      termMonths,
      included,
      reason: included
        ? `Within ${termMonths}-month term (${daysInForce} days)`
        : `Exceeded ${termMonths}-month term (${daysInForce} days)`,
    });
  }

  return result;
}

/**
 * Apply self-gen penalty when below threshold
 * Supports: percent_reduction, flat_reduction, tier_demotion
 */
export function applySelfGenPenalty(
  selfGenPercent: number,
  requirement: SelfGenRequirement | undefined,
  currentTierIndex: number,
  baseCommission: number
): SelfGenPenaltyResult {
  const result: SelfGenPenaltyResult = {
    applied: false,
    penaltyType: null,
    penaltyValue: 0,
    originalTierIndex: currentTierIndex,
    adjustedTierIndex: currentTierIndex,
    commissionReduction: 0,
  };

  if (!requirement?.enabled) return result;
  if (selfGenPercent >= requirement.min_percent) return result;

  result.applied = true;
  result.penaltyType = requirement.penalty_type;
  result.penaltyValue = requirement.penalty_value;

  switch (requirement.penalty_type) {
    case 'percent_reduction':
      result.commissionReduction = baseCommission * (requirement.penalty_value / 100);
      break;
    case 'flat_reduction':
      result.commissionReduction = Math.min(requirement.penalty_value, baseCommission);
      break;
    case 'tier_demotion':
      const tiersToDrop = Math.floor(requirement.penalty_value);
      result.adjustedTierIndex = Math.max(0, currentTierIndex - tiersToDrop);
      break;
  }

  return result;
}

/**
 * Apply self-gen bonus when above threshold
 * Supports: percent_boost, flat_bonus, per_item, per_policy, per_household, tier_promotion
 */
export function applySelfGenBonus(
  selfGenPercent: number,
  bonus: SelfGenBonus | undefined,
  selfGenMetrics: { selfGenItems: number; selfGenPolicies: number; selfGenHouseholds: number },
  currentTierIndex: number,
  totalTiers: number,
  baseCommission: number
): SelfGenBonusResult {
  const result: SelfGenBonusResult = {
    applied: false,
    bonusType: null,
    bonusValue: 0,
    bonusAmount: 0,
    tierPromotion: 0,
  };

  if (!bonus?.enabled) return result;
  if (selfGenPercent < bonus.min_percent) return result;

  result.applied = true;
  result.bonusType = bonus.bonus_type;
  result.bonusValue = bonus.bonus_value;

  switch (bonus.bonus_type) {
    case 'percent_boost':
      result.bonusAmount = baseCommission * (bonus.bonus_value / 100);
      break;
    case 'flat_bonus':
      result.bonusAmount = bonus.bonus_value;
      break;
    case 'per_item':
      result.bonusAmount = selfGenMetrics.selfGenItems * bonus.bonus_value;
      break;
    case 'per_policy':
      result.bonusAmount = selfGenMetrics.selfGenPolicies * bonus.bonus_value;
      break;
    case 'per_household':
      result.bonusAmount = selfGenMetrics.selfGenHouseholds * bonus.bonus_value;
      break;
    case 'tier_promotion':
      result.tierPromotion = Math.min(
        Math.floor(bonus.bonus_value),
        totalTiers - 1 - currentTierIndex
      );
      break;
  }

  return result;
}

/**
 * Brokered business metrics (from sales table)
 */
export interface BrokeredMetrics {
  items: number;
  premium: number;
  policies: number;
  households: number;
}

/**
 * Calculate commission for brokered business
 * Uses brokered_payout_type and brokered_flat_rate or brokered_tiers
 */
export function calculateBrokeredCommission(
  brokeredMetrics: BrokeredMetrics | undefined,
  plan: CompPlan
): number {
  if (!brokeredMetrics || (brokeredMetrics.items === 0 && brokeredMetrics.premium === 0)) {
    return 0;
  }

  const payoutType = plan.brokered_payout_type || 'flat_per_item';
  const flatRate = plan.brokered_flat_rate || 0;
  const brokeredTiers = plan.brokered_tiers || [];

  switch (payoutType) {
    case 'flat_per_item':
      return brokeredMetrics.items * flatRate;

    case 'percent_of_premium':
      return brokeredMetrics.premium * (flatRate / 100);

    case 'tiered':
      // Find matching brokered tier based on items
      const tierMatch = findMatchingTier(brokeredTiers, brokeredMetrics.items);
      if (!tierMatch) return 0;

      // Determine if tiered rate is % or flat based on value range
      // Rates > 1 are typically flat per item, <= 1 are percentages
      if (tierMatch.commissionValue > 1) {
        return brokeredMetrics.items * tierMatch.commissionValue;
      } else {
        return brokeredMetrics.premium * tierMatch.commissionValue;
      }

    default:
      return 0;
  }
}

/**
 * Find the tier that matches the given metric value
 */
export function findMatchingTier(
  tiers: CompPlanTier[],
  metricValue: number
): TierMatch | null {
  if (!tiers || tiers.length === 0) return null;

  // Sort tiers by threshold descending to find highest qualifying tier
  const sortedTiers = [...tiers].sort((a, b) => b.min_threshold - a.min_threshold);

  // DEBUG: Log tier comparison process
  console.log('[findMatchingTier] Searching for tier:', {
    metricValue,
    tiersDescending: sortedTiers.map(t => ({ threshold: t.min_threshold, rate: t.commission_value })),
  });

  for (const tier of sortedTiers) {
    const qualifies = metricValue >= tier.min_threshold;
    console.log(`[findMatchingTier] Check: ${metricValue} >= ${tier.min_threshold}? ${qualifies} (rate: ${tier.commission_value}%)`);
    if (qualifies) {
      return {
        tierId: tier.id,
        minThreshold: tier.min_threshold,
        commissionValue: tier.commission_value,
        metricValue,
      };
    }
  }

  return null;
}

/**
 * Get the metric value based on the tier metric type and source (written vs issued)
 * @param source - 'written' (default) or 'issued' - configurable per comp plan
 */
export function getMetricValue(
  performance: SubProducerPerformance,
  tierMetric: string,
  source: 'written' | 'issued' = 'written'
): number {
  const isIssued = source === 'issued';

  switch (tierMetric) {
    case 'premium':
      return isIssued ? performance.issuedPremium : performance.writtenPremium;
    case 'items':
      return isIssued ? performance.issuedItems : performance.writtenItems;
    case 'policies':
      return isIssued ? performance.issuedPolicies : performance.writtenPolicies;
    case 'households':
      // Note: issuedHouseholds not tracked separately, use written
      return performance.writtenHouseholds;
    case 'points':
      return isIssued ? performance.issuedPoints : performance.writtenPoints;
    default:
      return isIssued ? performance.issuedPremium : performance.writtenPremium;
  }
}

/**
 * Calculate custom points using point_values configuration
 * Each product gets a custom point weight (e.g., Auto=1, Home=2, Life=3)
 */
export function calculateCustomPoints(
  performance: SubProducerPerformance,
  pointValues: PointValues
): number {
  if (!pointValues || Object.keys(pointValues).length === 0) {
    // No custom point values, return standard points (item count)
    return performance.writtenPoints;
  }

  let totalPoints = 0;

  // Calculate points for each product
  for (const productData of performance.byProduct) {
    const productName = productData.product;
    const pointValue = pointValues[productName] ?? 1; // Default to 1 point if not specified
    totalPoints += productData.itemsIssued * pointValue;
  }

  return totalPoints;
}

/**
 * Get the bundling multiplier based on bundling percentage
 * Returns 1.0 if no multiplier applies
 */
export function getBundlingMultiplier(
  bundlingPercent: number,
  bundlingMultipliers: BundlingMultipliers | null
): number {
  if (!bundlingMultipliers?.thresholds || bundlingMultipliers.thresholds.length === 0) {
    return 1.0;
  }

  // Sort thresholds descending to find highest qualifying multiplier
  const sortedThresholds = [...bundlingMultipliers.thresholds]
    .sort((a, b) => b.min_percent - a.min_percent);

  for (const threshold of sortedThresholds) {
    if (bundlingPercent >= threshold.min_percent) {
      return threshold.multiplier;
    }
  }

  return 1.0; // No threshold met
}

/**
 * Calculate bundling percentage from performance data
 * Bundling % = (Standard + Preferred items) / Total items * 100
 *
 * When includeBrokeredInBundling is true and brokeredBundlingMetrics is provided,
 * brokered sales marked for bundling are included in the calculation.
 */
export function calculateBundlingPercent(
  performance: SubProducerPerformance,
  brokeredBundlingMetrics?: BrokeredBundlingMetrics,
  includeBrokeredInBundling: boolean = false
): number {
  // Base metrics from Allstate statement data
  let totalItems = performance.writtenItems;
  let bundledItems = 0;

  // Calculate bundled items from statement data (existing logic)
  for (const bundleData of performance.byBundleType) {
    const bundleType = bundleData.bundleType.toLowerCase();
    if (bundleType === 'standard' || bundleType === 'preferred') {
      bundledItems += bundleData.itemsIssued;
    }
  }

  // ADDITIVE: Include brokered bundling metrics if enabled
  if (includeBrokeredInBundling && brokeredBundlingMetrics) {
    bundledItems += brokeredBundlingMetrics.bundledItems;
    totalItems += brokeredBundlingMetrics.totalItems;
  }

  if (totalItems === 0) return 0;
  return (bundledItems / totalItems) * 100;
}

/**
 * Check if self-gen requirement is met
 * Returns { met: boolean, selfGenPercent: number }
 */
export function checkSelfGenRequirement(
  performance: SubProducerPerformance,
  modifiers: CommissionModifiers | null,
  selfGenItems: number // From sales data - items marked as self-generated
): { met: boolean; selfGenPercent: number } {
  if (!modifiers?.self_gen_requirement) {
    return { met: true, selfGenPercent: 0 };
  }

  const req = modifiers.self_gen_requirement;
  const totalItems = req.source === 'written'
    ? performance.writtenItems
    : performance.issuedItems;

  if (totalItems === 0) {
    return { met: false, selfGenPercent: 0 };
  }

  const selfGenPercent = (selfGenItems / totalItems) * 100;
  const met = selfGenPercent >= req.min_percent;

  return { met, selfGenPercent };
}

/**
 * Calculate self-gen kicker bonus
 * Returns bonus amount if qualification is met, otherwise 0
 */
export function calculateSelfGenKicker(
  performance: SubProducerPerformance,
  modifiers: CommissionModifiers | null,
  selfGenItems: number,
  selfGenMetrics?: SelfGenMetrics
): number {
  if (!modifiers?.self_gen_kicker?.enabled) {
    return 0;
  }

  const kicker = modifiers.self_gen_kicker;
  const { selfGenPercent } = checkSelfGenRequirement(performance, modifiers, selfGenItems);

  if (selfGenPercent < kicker.min_self_gen_percent) {
    return 0;
  }

  // Calculate bonus based on kicker type
  let count = 0;
  switch (kicker.type) {
    case 'per_item':
      count = selfGenItems;
      break;
    case 'per_policy':
      // Use exact policy count from sales metrics when available
      count = selfGenMetrics?.selfGenPolicies ??
        Math.round((selfGenPercent / 100) * performance.writtenPolicies);
      break;
    case 'per_household':
      // Use exact household count from sales metrics when available
      count = selfGenMetrics?.selfGenHouseholds ??
        Math.round((selfGenPercent / 100) * performance.writtenHouseholds);
      break;
  }

  return count * kicker.amount;
}

/**
 * Calculate commission based on payout type, tier, and chargeback rule
 */
export function calculateCommission(
  performance: SubProducerPerformance,
  plan: CompPlan,
  tierMatch: TierMatch | null
): { baseCommission: number; bonusAmount: number; totalPayout: number } {
  if (!tierMatch) {
    return { baseCommission: 0, bonusAmount: 0, totalPayout: 0 };
  }
  
  const { commissionValue } = tierMatch;
  let baseCommission = 0;
  const bonusAmount = 0;
  
  // Determine which chargeback amount to use based on rule
  let effectiveChargebackPremium = 0;
  let effectiveChargebackCount = 0;
  
  switch (plan.chargeback_rule) {
    case 'none':
      // No chargebacks deducted
      effectiveChargebackPremium = 0;
      effectiveChargebackCount = 0;
      break;
    case 'three_month':
      // Only count chargebacks where policy was in force < 90 days
      effectiveChargebackPremium = performance.eligibleChargebackPremium;
      effectiveChargebackCount = performance.eligibleChargebackCount;
      break;
    case 'full':
    default:
      // All chargebacks apply
      effectiveChargebackPremium = performance.chargebackPremium;
      effectiveChargebackCount = performance.chargebackCount;
      break;
  }
  
  // Calculate effective net premium for commission calculation
  const effectiveNetPremium = performance.issuedPremium - effectiveChargebackPremium;
  
  // Calculate based on payout type
  switch (plan.payout_type) {
    case 'percent_of_premium':
      // Commission value is a percentage of effective net premium
      baseCommission = effectiveNetPremium * (commissionValue / 100);
      break;
    case 'flat_per_item':
      // Commission value is a flat amount per issued item minus chargebacks
      baseCommission = (performance.issuedItems - effectiveChargebackCount) * commissionValue;
      break;
    case 'flat_per_policy':
      // Commission value is a flat amount per issued policy minus chargebacks
      baseCommission = (performance.issuedPolicies - effectiveChargebackCount) * commissionValue;
      break;
    case 'flat_per_household':
      // Commission value is a flat amount per household
      baseCommission = performance.writtenHouseholds * commissionValue;
      break;
    default:
      // Default to percentage of effective net premium
      baseCommission = effectiveNetPremium * (commissionValue / 100);
  }
  
  // Ensure non-negative
  baseCommission = Math.max(0, baseCommission);
  
  const totalPayout = baseCommission + bonusAmount;
  
  return { baseCommission, bonusAmount, totalPayout };
}

/**
 * Calculate commission for a single bundle type or product segment
 */
function calculateSegmentCommission(
  premium: number,
  items: number,
  payoutType: string,
  rate: number,
  chargebackCount: number = 0
): number {
  let commission = 0;

  switch (payoutType) {
    case 'percent_of_premium':
      commission = premium * (rate / 100);
      break;
    case 'flat_per_item':
      commission = Math.max(0, items - chargebackCount) * rate;
      break;
    case 'flat_per_policy':
      // For segments, treat items as policies
      commission = Math.max(0, items - chargebackCount) * rate;
      break;
    case 'flat_per_household':
      // For segments, approximate households as unique items
      commission = items * rate;
      break;
    default:
      commission = premium * (rate / 100);
  }

  return Math.max(0, commission);
}

/**
 * Get the effective rate for a bundle type config, considering tiers if applicable
 */
function getBundleTypeEffectiveRate(
  config: BundleTypeConfig,
  metricValue: number
): number {
  if (!config.enabled) return 0;

  // If tiers are defined, find matching tier
  if (config.tiers && config.tiers.length > 0) {
    const sortedTiers = [...config.tiers].sort((a, b) => b.min_threshold - a.min_threshold);
    for (const tier of sortedTiers) {
      if (metricValue >= tier.min_threshold) {
        return tier.commission_value;
      }
    }
    // No tier matched, return 0
    return 0;
  }

  // Simple rate (no tiers)
  return config.rate || 0;
}

/**
 * Calculate commission using bundle type configurations
 * Returns the total commission and a breakdown by bundle type
 */
export function calculateCommissionWithBundleConfigs(
  performance: SubProducerPerformance,
  bundleConfigs: BundleConfigs,
  tierMetric: string,
  chargebackRule: string,
  tierMatch?: TierMatch | null  // Added: fallback tier rate for unconfigured bundle types
): {
  totalCommission: number;
  breakdown: Array<{ bundleType: string; premium: number; items: number; commission: number }>;
} {
  const breakdown: Array<{ bundleType: string; premium: number; items: number; commission: number }> = [];
  let totalCommission = 0;

  // Get the overall metric value for tier matching
  const metricValue = getMetricValue(performance, tierMetric);

  // Fallback tier rate for bundle types without explicit config
  const fallbackTierRate = tierMatch?.commissionValue || 0;

  const bundleChargebackMap = new Map(
    (performance.chargebackByBundle || []).map((b) => [normalizeBundleTypeKey(b.bundleType), b])
  );

  // Process each bundle type
  for (const bundleData of performance.byBundleType) {
    const bundleType = bundleData.bundleType.toLowerCase();
    const config = bundleConfigs[bundleType as keyof BundleConfigs];

    // Determine effective rate: use config if exists, otherwise fall back to tier rate
    let effectiveRate: number;
    let payoutType = 'percent_of_premium'; // Default payout type

    if (config && config.enabled) {
      effectiveRate = getBundleTypeEffectiveRate(config, metricValue);
      payoutType = config.payout_type || 'percent_of_premium';
    } else {
      // No config for this bundle type - use the plan's tier rate
      effectiveRate = fallbackTierRate;
      console.log(`[calculateCommissionWithBundleConfigs] No config for ${bundleType}, using tier rate: ${effectiveRate}%`);
    }

    if (effectiveRate <= 0) {
      const bundleChargeback = bundleChargebackMap.get(bundleType);
      const premiumRatio = bundleChargeback && bundleChargeback.totalPremium > 0
        ? bundleChargeback.eligiblePremium / bundleChargeback.totalPremium
        : 0;
      const countRatio = bundleChargeback && bundleChargeback.totalCount > 0
        ? bundleChargeback.eligibleCount / bundleChargeback.totalCount
        : 0;
      const effectivePremium = Math.max(0, bundleData.premiumWritten - (bundleData.premiumChargebacks * premiumRatio));
      const effectiveItems = Math.max(0, bundleData.creditCount - Math.round(bundleData.chargebackCount * countRatio));
      breakdown.push({
        bundleType: bundleData.bundleType,
        premium: effectivePremium,
        items: effectiveItems,
        commission: 0
      });
      continue;
    }

    const bundleChargeback = bundleChargebackMap.get(bundleType);
    const premiumRatio = bundleChargeback && bundleChargeback.totalPremium > 0
      ? bundleChargeback.eligiblePremium / bundleChargeback.totalPremium
      : 0;
    const countRatio = bundleChargeback && bundleChargeback.totalCount > 0
      ? bundleChargeback.eligibleCount / bundleChargeback.totalCount
      : 0;
    const effectivePremium = Math.max(0, bundleData.premiumWritten - (bundleData.premiumChargebacks * premiumRatio));
    const effectiveItems = Math.max(0, bundleData.creditCount - Math.round(bundleData.chargebackCount * countRatio));

    const commission = calculateSegmentCommission(
      effectivePremium,
      effectiveItems,
      payoutType,
      effectiveRate,
      0
    );

    console.log(`[calculateCommissionWithBundleConfigs] ${bundleType}: premium=${effectivePremium}, items=${effectiveItems}, rate=${effectiveRate}%, commission=${commission}`);

    breakdown.push({
      bundleType: bundleData.bundleType,
      premium: effectivePremium,
      items: effectiveItems,
      commission
    });

    totalCommission += commission;
  }

  return { totalCommission, breakdown };
}

/**
 * Calculate commission using product rate configurations
 * Returns the total commission and a breakdown by product
 */
export function calculateCommissionWithProductRates(
  performance: SubProducerPerformance,
  productRates: ProductRates,
  chargebackRule: string
): {
  totalCommission: number;
  breakdown: Array<{ product: string; premium: number; items: number; commission: number }>;
} {
  const breakdown: Array<{ product: string; premium: number; items: number; commission: number }> = [];
  let totalCommission = 0;

  const productChargebackMap = new Map(
    (performance.chargebackByProduct || []).map((p) => [normalizeProductKey(p.product), p])
  );

  // Process each product
  for (const productData of performance.byProduct) {
    const productName = productData.product;
    const config = productRates[productName];

    if (!config) {
      // No rate configured for this product, skip it
      const productChargeback = productChargebackMap.get(normalizeProductKey(productName));
      const premiumRatio = productChargeback && productChargeback.totalPremium > 0
        ? productChargeback.eligiblePremium / productChargeback.totalPremium
        : 0;
      const countRatio = productChargeback && productChargeback.totalCount > 0
        ? productChargeback.eligibleCount / productChargeback.totalCount
        : 0;
      const effectivePremium = Math.max(0, productData.premiumWritten - (productData.premiumChargebacks * premiumRatio));
      const effectiveItems = Math.max(0, productData.creditCount - Math.round(productData.chargebackCount * countRatio));
      breakdown.push({
        product: productName,
        premium: effectivePremium,
        items: effectiveItems,
        commission: 0
      });
      continue;
    }

    const productChargeback = productChargebackMap.get(normalizeProductKey(productName));
    const premiumRatio = productChargeback && productChargeback.totalPremium > 0
      ? productChargeback.eligiblePremium / productChargeback.totalPremium
      : 0;
    const countRatio = productChargeback && productChargeback.totalCount > 0
      ? productChargeback.eligibleCount / productChargeback.totalCount
      : 0;
    const effectivePremium = Math.max(0, productData.premiumWritten - (productData.premiumChargebacks * premiumRatio));
    const effectiveItems = Math.max(0, productData.creditCount - Math.round(productData.chargebackCount * countRatio));

    const commission = calculateSegmentCommission(
      effectivePremium,
      effectiveItems,
      config.payout_type,
      config.rate,
      0
    );

    breakdown.push({
      product: productName,
      premium: effectivePremium,
      items: effectiveItems,
      commission
    });

    totalCommission += commission;
  }

  return { totalCommission, breakdown };
}

/**
 * Convert SubProducerMetrics to SubProducerPerformance
 * Includes 3-month rule filtering when applicable
 */
export function convertToPerformance(
  metrics: SubProducerMetrics,
  teamMemberId: string | null,
  teamMemberName: string | null,
  chargebackRule: string,
  periodMonth: number,
  periodYear: number,
  productTermMonths: Map<string, number>
): SubProducerPerformance {
  // Apply chargeback rule filtering
  let eligibleChargebackPremium = metrics.premiumChargebacks;
  let eligibleChargebackCount = metrics.chargebackCount;
  let excludedChargebackCount = 0;

  let chargebackDetails: ChargebackDetail[] = [];
  let chargebackByBundle: Array<{
    bundleType: string;
    totalPremium: number;
    totalCount: number;
    eligiblePremium: number;
    eligibleCount: number;
  }> = [];
  let chargebackByProduct: Array<{
    product: string;
    totalPremium: number;
    totalCount: number;
    eligiblePremium: number;
    eligibleCount: number;
  }> = [];

  const normalizedRule = chargebackRule === 'none' || chargebackRule === 'three_month' || chargebackRule === 'full'
    ? chargebackRule
    : 'three_month';

  if (metrics.chargebackTransactions?.length > 0) {
    const filtered = filterChargebacksByRule(
      metrics.chargebackTransactions,
      normalizedRule,
      periodMonth,
      periodYear,
      productTermMonths
    );
    eligibleChargebackPremium = filtered.eligiblePremium;
    eligibleChargebackCount = filtered.eligibleChargebacks.length;
    excludedChargebackCount = filtered.excludedChargebacks.length;
    chargebackDetails = filtered.details;

    const bundleTotals = new Map<string, { totalPremium: number; totalCount: number; eligiblePremium: number; eligibleCount: number }>();
    const productTotals = new Map<string, { totalPremium: number; totalCount: number; eligiblePremium: number; eligibleCount: number }>();
    const eligibleSet = new Set(filtered.eligibleChargebacks);

    for (const tx of metrics.chargebackTransactions) {
      const bundleKey = normalizeBundleTypeKey(tx.bundleType || 'monoline');
      const productKey = normalizeProductKey(tx.product || 'other');
      const premium = Math.abs(tx.premium || 0);
      const isEligible = eligibleSet.has(tx);

      if (!bundleTotals.has(bundleKey)) {
        bundleTotals.set(bundleKey, { totalPremium: 0, totalCount: 0, eligiblePremium: 0, eligibleCount: 0 });
      }
      if (!productTotals.has(productKey)) {
        productTotals.set(productKey, { totalPremium: 0, totalCount: 0, eligiblePremium: 0, eligibleCount: 0 });
      }

      const bundleEntry = bundleTotals.get(bundleKey)!;
      bundleEntry.totalPremium += premium;
      bundleEntry.totalCount += 1;
      if (isEligible) {
        bundleEntry.eligiblePremium += premium;
        bundleEntry.eligibleCount += 1;
      }

      const productEntry = productTotals.get(productKey)!;
      productEntry.totalPremium += premium;
      productEntry.totalCount += 1;
      if (isEligible) {
        productEntry.eligiblePremium += premium;
        productEntry.eligibleCount += 1;
      }
    }

    chargebackByBundle = Array.from(bundleTotals.entries()).map(([bundleType, totals]) => ({
      bundleType,
      ...totals,
    }));
    chargebackByProduct = Array.from(productTotals.entries()).map(([product, totals]) => ({
      product,
      ...totals,
    }));
  } else if (normalizedRule === 'none') {
    // No per-transaction data available: exclude all aggregated chargebacks
    eligibleChargebackPremium = 0;
    eligibleChargebackCount = 0;
    excludedChargebackCount = metrics.chargebackCount;
  }
  
  return {
    subProdCode: metrics.code,
    teamMemberId,
    teamMemberName,
    
    // Written metrics - using premium written as base
    writtenPremium: metrics.premiumWritten,
    writtenItems: metrics.itemsIssued,
    writtenPolicies: metrics.policiesIssued,
    writtenHouseholds: metrics.creditCount, // Using credit count as household proxy
    writtenPoints: metrics.creditCount, // Points can be customized
    
    // Issued metrics (same as written for first-term)
    issuedPremium: metrics.premiumWritten,
    issuedItems: metrics.itemsIssued,
    issuedPolicies: metrics.policiesIssued,
    issuedPoints: metrics.creditCount,
    
    // All chargebacks
    chargebackPremium: metrics.premiumChargebacks,
    chargebackCount: metrics.chargebackCount,
    
    // 3-month rule filtered chargebacks
    eligibleChargebackPremium,
    eligibleChargebackCount,
    excludedChargebackCount,
    
    // Net (based on all chargebacks - display purposes)
    netPremium: metrics.netPremium,
    netItems: metrics.creditCount - metrics.chargebackCount,
    
    // Raw data for detail views
    creditInsureds: metrics.creditInsureds || [],
    chargebackInsureds: metrics.chargebackInsureds || [],
    creditTransactions: metrics.creditTransactions || [],
    chargebackTransactions: metrics.chargebackTransactions || [],

    // Breakdowns for advanced compensation calculation
    byBundleType: metrics.byBundleType || [],
    byProduct: metrics.byProduct || [],
    chargebackDetails,
    chargebackByBundle,
    chargebackByProduct,
  };
}

/**
 * Calculate promo bonuses for a team member for a given period
 */
export async function calculatePromoBonus(
  teamMemberId: string,
  agencyId: string,
  periodMonth: number,
  periodYear: number
): Promise<{ bonusAmount: number; achievedPromos: AchievedPromo[] }> {
  // Get the start and end of the payout period
  const periodStart = new Date(periodYear, periodMonth - 1, 1);
  const periodEnd = new Date(periodYear, periodMonth, 0); // Last day of month
  
  const periodStartStr = periodStart.toISOString().split('T')[0];
  const periodEndStr = periodEnd.toISOString().split('T')[0];
  
  try {
    // Get promo goals assigned to this team member
    const { data: assignments, error: assignError } = await supabase
      .from("sales_goal_assignments")
      .select("sales_goal_id")
      .eq("team_member_id", teamMemberId);
    
    if (assignError) {
      console.error("Error fetching promo assignments:", assignError);
      return { bonusAmount: 0, achievedPromos: [] };
    }
    
    const goalIds = assignments?.map(a => a.sales_goal_id) || [];
    if (goalIds.length === 0) {
      return { bonusAmount: 0, achievedPromos: [] };
    }
    
    // Fetch promo goals that overlap with this period
    const { data: goals, error: goalsError } = await supabase
      .from("sales_goals")
      .select(`
        id,
        goal_name,
        measurement,
        target_value,
        bonus_amount_cents,
        start_date,
        end_date,
        promo_source,
        product_type_id,
        kpi_slug,
        goal_focus
      `)
      .in("id", goalIds)
      .eq("goal_type", "promo")
      .eq("is_active", true)
      .lte("start_date", periodEndStr)  // Promo starts before/during period end
      .gte("end_date", periodStartStr); // Promo ends after/during period start
    
    if (goalsError) {
      console.error("Error fetching promo goals:", goalsError);
      return { bonusAmount: 0, achievedPromos: [] };
    }
    
    if (!goals || goals.length === 0) {
      return { bonusAmount: 0, achievedPromos: [] };
    }
    
    const achievedPromos: AchievedPromo[] = [];
    let totalBonus = 0;
    
    for (const goal of goals) {
      try {
        const progress = await calculatePromoProgress(
          goal as PromoGoal,
          teamMemberId,
          agencyId
        );
        
        if (progress >= goal.target_value) {
          const bonusAmountDollars = (goal.bonus_amount_cents || 0) / 100;
          totalBonus += bonusAmountDollars;
          
          achievedPromos.push({
            promoId: goal.id,
            promoName: goal.goal_name,
            bonusAmount: bonusAmountDollars,
            targetValue: goal.target_value,
            achievedValue: progress,
          });
        }
      } catch (e) {
        console.error(`Error calculating promo progress for ${goal.goal_name}:`, e);
      }
    }
    
    return { bonusAmount: totalBonus, achievedPromos };
  } catch (e) {
    console.error("Error in calculatePromoBonus:", e);
    return { bonusAmount: 0, achievedPromos: [] };
  }
}

/**
 * Check if bundle configs have any enabled configurations
 */
function hasBundleConfigs(bundleConfigs: BundleConfigs | null | undefined): boolean {
  if (!bundleConfigs) return false;
  return (
    bundleConfigs.monoline?.enabled ||
    bundleConfigs.standard?.enabled ||
    bundleConfigs.preferred?.enabled
  ) || false;
}

/**
 * Check if product rates have any configurations
 */
function hasProductRates(productRates: ProductRates | null | undefined): boolean {
  if (!productRates) return false;
  return Object.keys(productRates).length > 0;
}

/**
 * Calculate payout for a single team member
 * Supports bundle-type-specific and product-specific rate configurations
 * Also supports custom point values, bundling multipliers, and self-gen modifiers
 *
 * @param selfGenMetrics - Self-gen metrics from calculateSelfGenMetrics (Phase 2+)
 * @param brokeredMetrics - Brokered business metrics from sales table (Phase 5)
 * @param writtenMetrics - Written metrics from sales table (for tier qualification when source = 'written')
 */
export function calculateMemberPayout(
  performance: SubProducerPerformance,
  plan: CompPlan,
  periodMonth: number,
  periodYear: number,
  promoBonus: { bonusAmount: number; achievedPromos: AchievedPromo[] } = { bonusAmount: 0, achievedPromos: [] },
  selfGenItems: number = 0, // Legacy: items marked as self-generated
  selfGenMetrics?: SelfGenMetrics, // New: full self-gen metrics from sales table
  brokeredMetrics?: BrokeredMetrics, // Phase 5: brokered business metrics
  writtenMetrics?: WrittenMetrics, // Written metrics from sales table for tier qualification
  brokeredBundlingMetrics?: BrokeredBundlingMetrics // Brokered sales marked for bundling
): PayoutCalculation {
  // Get tier metric source from plan (written or issued)
  const tierMetricSource = (plan as any).tier_metric_source || 'written';

  // Calculate custom points if point_values is configured and tier_metric is 'points'
  let customPointsCalculated: number | undefined;
  let metricValue: number;

  // Determine metric value based on tier_metric_source
  if (tierMetricSource === 'written' && writtenMetrics) {
    // Use sales table data for tier qualification (manual entries)
    switch (plan.tier_metric) {
      case 'items':
        metricValue = writtenMetrics.writtenItems;
        break;
      case 'premium':
        metricValue = writtenMetrics.writtenPremium;
        break;
      case 'policies':
        metricValue = writtenMetrics.writtenPolicies;
        break;
      case 'households':
        metricValue = writtenMetrics.writtenHouseholds;
        break;
      default:
        metricValue = writtenMetrics.writtenItems;
    }
    console.log('[calculateMemberPayout] Using SALES TABLE data for tier qualification:', {
      teamMemberName: performance.teamMemberName,
      source: 'written (sales table)',
      tierMetric: plan.tier_metric,
      metricValue,
      writtenMetrics,
    });
  } else {
    // Use Allstate statement data (issued) - fallback or when source = 'issued'
    metricValue = getMetricValue(performance, plan.tier_metric, tierMetricSource);
    console.log('[calculateMemberPayout] Using STATEMENT data for tier qualification:', {
      teamMemberName: performance.teamMemberName,
      source: tierMetricSource === 'written' ? 'written (no sales data, using statement)' : 'issued (statement)',
      tierMetric: plan.tier_metric,
      metricValue,
    });
  }

  if (plan.tier_metric === 'points' && plan.point_values && Object.keys(plan.point_values).length > 0) {
    customPointsCalculated = calculateCustomPoints(performance, plan.point_values);
    metricValue = customPointsCalculated;
  }

  // Determine self-gen percentage (prefer new metrics if available)
  const selfGenPercent = selfGenMetrics?.selfGenPercent ??
    (selfGenItems > 0 && performance.writtenItems > 0
      ? (selfGenItems / performance.writtenItems) * 100
      : 0);

  // Check legacy self-gen requirement
  const selfGenCheck = checkSelfGenRequirement(performance, plan.commission_modifiers, selfGenItems);
  const selfGenMetRequirement = selfGenCheck.met;

  // Find initial matching tier
  // Sort tiers once for consistent index calculations
  const sortedTiers = [...plan.tiers].sort((a, b) => a.min_threshold - b.min_threshold);
  let tierMatch = findMatchingTier(plan.tiers, metricValue);
  // Use sorted array for currentTierIndex to ensure tier demotion/promotion works correctly
  let currentTierIndex = tierMatch ? sortedTiers.findIndex(t => t.id === tierMatch!.tierId) : -1;

  // DEBUG: Log tier matching result
  console.log('[findMatchingTier result]', {
    teamMemberName: performance.teamMemberName,
    tierId: tierMatch?.tierId,
    minThreshold: tierMatch?.minThreshold,
    commissionValue: tierMatch?.commissionValue,
    metricValueUsed: metricValue,
    currentTierIndex,
    sortedTiersOrder: sortedTiers.map(t => ({ threshold: t.min_threshold, rate: t.commission_value })),
  });

  // Calculate bundling percentage and get multiplier
  // Include brokered bundling metrics if comp plan has include_brokered_in_bundling enabled
  const bundlingPercent = calculateBundlingPercent(
    performance,
    brokeredBundlingMetrics,
    plan.include_brokered_in_bundling === true
  );
  const bundlingMultiplier = getBundlingMultiplier(bundlingPercent, plan.bundling_multipliers);

  // Determine which calculation method to use
  // Priority: product_rates > bundle_configs > default
  let baseCommission = 0;
  let commissionByBundleType: Array<{ bundleType: string; premium: number; items: number; commission: number }> | undefined;
  let commissionByProduct: Array<{ product: string; premium: number; items: number; commission: number }> | undefined;

  if (hasProductRates(plan.product_rates)) {
    const result = calculateCommissionWithProductRates(
      performance,
      plan.product_rates!,
      plan.chargeback_rule
    );
    baseCommission = result.totalCommission;
    commissionByProduct = result.breakdown;
  } else if (hasBundleConfigs(plan.bundle_configs)) {
    const result = calculateCommissionWithBundleConfigs(
      performance,
      plan.bundle_configs!,
      plan.tier_metric,
      plan.chargeback_rule,
      tierMatch  // Pass tier rate for fallback
    );
    baseCommission = result.totalCommission;
    commissionByBundleType = result.breakdown;
  } else {
    const result = calculateCommission(performance, plan, tierMatch);
    baseCommission = result.baseCommission;
  }

  // Store base commission before modifiers for audit trail
  const baseBeforeModifiers = baseCommission;

  // Apply bundling multiplier to base commission
  let bundlingBoost = 0;
  if (bundlingMultiplier > 1.0) {
    bundlingBoost = baseCommission * (bundlingMultiplier - 1);
    baseCommission = baseCommission * bundlingMultiplier;
  }

  // Apply self-gen penalty if below requirement threshold (Phase 3)
  let selfGenPenaltyAmount = 0;
  const selfGenRequirement = plan.commission_modifiers?.self_gen_requirement as SelfGenRequirement | undefined;
  if (selfGenRequirement?.enabled) {
    const penaltyResult = applySelfGenPenalty(
      selfGenPercent,
      selfGenRequirement,
      currentTierIndex,
      baseCommission
    );

    if (penaltyResult.applied) {
      if (penaltyResult.penaltyType === 'tier_demotion' && penaltyResult.adjustedTierIndex !== currentTierIndex) {
        // Re-find tier at adjusted index and recalculate (using pre-sorted tiers)
        const adjustedTier = sortedTiers[penaltyResult.adjustedTierIndex!];
        if (adjustedTier) {
          tierMatch = {
            tierId: adjustedTier.id,
            minThreshold: adjustedTier.min_threshold,
            commissionValue: adjustedTier.commission_value,
            metricValue,
          };
          // Recalculate base commission at demoted tier
          const result = calculateCommission(performance, plan, tierMatch);
          selfGenPenaltyAmount = baseCommission - result.baseCommission;
          baseCommission = result.baseCommission;
        }
      } else {
        selfGenPenaltyAmount = penaltyResult.commissionReduction;
        baseCommission = Math.max(0, baseCommission - selfGenPenaltyAmount);
      }
      console.log(`[calculateMemberPayout] Self-gen penalty applied: ${penaltyResult.penaltyType} = -$${selfGenPenaltyAmount.toFixed(2)}`);
    }
  }

  // Apply self-gen bonus if above threshold (Phase 3)
  let selfGenBonusAmount = 0;
  const selfGenBonusConfig = plan.commission_modifiers?.self_gen_bonus as SelfGenBonus | undefined;
  if (selfGenBonusConfig?.enabled && selfGenMetrics) {
    const bonusResult = applySelfGenBonus(
      selfGenPercent,
      selfGenBonusConfig,
      {
        selfGenItems: selfGenMetrics.selfGenItems,
        selfGenPolicies: selfGenMetrics.selfGenPolicies,
        selfGenHouseholds: selfGenMetrics.selfGenHouseholds,
      },
      currentTierIndex,
      plan.tiers.length,
      baseCommission
    );

    if (bonusResult.applied) {
      if (bonusResult.tierPromotion > 0) {
        // Apply tier promotion (using pre-sorted tiers)
        const promotedIndex = Math.min(currentTierIndex + bonusResult.tierPromotion, sortedTiers.length - 1);
        const promotedTier = sortedTiers[promotedIndex];
        if (promotedTier) {
          tierMatch = {
            tierId: promotedTier.id,
            minThreshold: promotedTier.min_threshold,
            commissionValue: promotedTier.commission_value,
            metricValue,
          };
          // Recalculate at promoted tier
          const result = calculateCommission(performance, plan, tierMatch);
          selfGenBonusAmount = result.baseCommission - baseCommission;
          baseCommission = result.baseCommission;
        }
      } else {
        selfGenBonusAmount = bonusResult.bonusAmount;
      }
      console.log(`[calculateMemberPayout] Self-gen bonus applied: ${bonusResult.bonusType} = +$${selfGenBonusAmount.toFixed(2)}`);
    }
  }

  // Calculate legacy self-gen kicker bonus (backward compatibility)
  const selfGenKickerAmount = calculateSelfGenKicker(
    performance,
    plan.commission_modifiers,
    selfGenItems,
    selfGenMetrics
  );

  // Calculate brokered commission (Phase 5)
  const brokeredCommission = calculateBrokeredCommission(brokeredMetrics, plan);
  if (brokeredCommission > 0) {
    console.log(`[calculateMemberPayout] Brokered commission: +$${brokeredCommission.toFixed(2)}`);
  }

  // Add brokered items/premium to tier metric if configured
  if (plan.brokered_counts_toward_tier && brokeredMetrics) {
    // Note: This would need to be applied before tier matching for full implementation
    // For now, we just include brokered commission in the total
  }

  // Calculate total payout
  const totalPayout = baseCommission + promoBonus.bonusAmount + selfGenKickerAmount + selfGenBonusAmount + brokeredCommission;

  // Build calculation snapshot for audit trail (Phase 8)
  const calculationSnapshot: CalculationSnapshot = {
    inputs: {
      writtenItems: performance.writtenItems,
      writtenPremium: performance.writtenPremium,
      issuedItems: performance.issuedItems,
      issuedPremium: performance.issuedPremium,
      chargebackCount: performance.chargebackCount,
      chargebackPremium: performance.chargebackPremium,
      tierMetric: plan.tier_metric,
      tierMetricSource,
      chargebackRule: plan.chargeback_rule,
    },
    tierMatched: tierMatch ? {
      tierId: tierMatch.tierId,
      threshold: tierMatch.minThreshold,
      rate: tierMatch.commissionValue,
    } : null,
    selfGen: {
      percent: selfGenPercent,
      metRequirement: selfGenMetRequirement,
      penaltyApplied: selfGenPenaltyAmount > 0,
      penaltyAmount: selfGenPenaltyAmount,
      bonusApplied: selfGenBonusAmount > 0,
      bonusAmount: selfGenBonusAmount,
    },
    bundling: {
      percent: bundlingPercent,
      multiplier: bundlingMultiplier,
    },
    calculations: {
      baseBeforeModifiers,
      selfGenPenalty: selfGenPenaltyAmount,
      selfGenBonus: selfGenBonusAmount,
      bundlingBoost,
      brokeredCommission,
      promoBonus: promoBonus.bonusAmount,
      finalTotal: totalPayout,
    },
    calculatedAt: new Date().toISOString(),
  };

  console.log(`[calculateMemberPayout] ${performance.teamMemberName}: creditInsureds=${performance.creditInsureds?.length || 0}, chargebackInsureds=${performance.chargebackInsureds?.length || 0}`);

  return {
    teamMemberId: performance.teamMemberId || '',
    teamMemberName: performance.teamMemberName || performance.subProdCode,
    compPlanId: plan.id,
    compPlanName: plan.name,
    periodMonth,
    periodYear,

    // Written metrics
    writtenPremium: performance.writtenPremium,
    writtenItems: performance.writtenItems,
    writtenPolicies: performance.writtenPolicies,
    writtenHouseholds: performance.writtenHouseholds,
    writtenPoints: performance.writtenPoints,

    // Issued metrics
    issuedPremium: performance.issuedPremium,
    issuedItems: performance.issuedItems,
    issuedPolicies: performance.issuedPolicies,
    issuedPoints: performance.issuedPoints,

    // Chargebacks (all)
    chargebackPremium: performance.chargebackPremium,
    chargebackCount: performance.chargebackCount,

    // 3-Month Rule tracking
    eligibleChargebackPremium: performance.eligibleChargebackPremium,
    eligibleChargebackCount: performance.eligibleChargebackCount,
    excludedChargebackCount: performance.excludedChargebackCount,
    chargebackRule: plan.chargeback_rule,

    // Net
    netPremium: performance.netPremium,
    netItems: performance.netItems,

    // Tier
    tierMatch,
    tierThresholdMet: tierMatch?.minThreshold || 0,
    tierCommissionValue: tierMatch?.commissionValue || 0,

    // Commission
    baseCommission,
    bonusAmount: promoBonus.bonusAmount,
    totalPayout,

    // Commission breakdowns (when using advanced configurations)
    commissionByBundleType,
    commissionByProduct,

    // Extended modifier tracking (Phase 2)
    customPointsCalculated,
    bundlingPercent,
    bundlingMultiplier: bundlingMultiplier > 1.0 ? bundlingMultiplier : undefined,
    selfGenPercent: selfGenPercent > 0 ? selfGenPercent : undefined,
    selfGenKickerAmount: selfGenKickerAmount > 0 ? selfGenKickerAmount : undefined,

    // Self-gen penalty/bonus tracking (Phase 3)
    selfGenMetRequirement,
    selfGenPenaltyAmount: selfGenPenaltyAmount > 0 ? selfGenPenaltyAmount : undefined,
    selfGenBonusAmount: selfGenBonusAmount > 0 ? selfGenBonusAmount : undefined,

    // Brokered commission (Phase 5)
    brokeredCommission: brokeredCommission > 0 ? brokeredCommission : undefined,

    // Chargeback details (Phase 4)
    chargebackDetails: performance.chargebackDetails,

    // Calculation snapshot for audit (Phase 8)
    calculationSnapshot,

    // Promo bonuses
    achievedPromos: promoBonus.achievedPromos,

    // Rollover (written - issued for future months)
    rolloverPremium: 0, // Calculated separately if needed

    // Status
    status: 'draft',

    // Raw data for detail views
    creditInsureds: performance.creditInsureds,
    chargebackInsureds: performance.chargebackInsureds,
  };
}

/**
 * Calculate payouts for all assigned team members (async for promo bonus calculation)
 * @param manualOverrides - Optional manual overrides for written metrics (for testing)
 * @param selfGenByMember - Map of team_member_id -> self-gen item count from sales data (legacy)
 * @param selfGenMetricsByMember - Map of team_member_id -> full SelfGenMetrics (Phase 3)
 * @param brokeredMetricsByMember - Map of team_member_id -> BrokeredMetrics (Phase 5)
 * @param writtenMetricsByMember - Map of team_member_id -> WrittenMetrics from sales table (for tier qualification when source = 'written')
 */
export async function calculateAllPayouts(
  subProducerData: SubProducerMetrics[] | undefined | null,
  plans: CompPlan[],
  assignments: Assignment[],
  teamMembers: TeamMember[],
  periodMonth: number,
  periodYear: number,
  agencyId: string,
  manualOverrides?: ManualOverride[],
  selfGenByMember?: Map<string, number>,
  selfGenMetricsByMember?: Map<string, SelfGenMetrics>,
  brokeredMetricsByMember?: Map<string, BrokeredMetrics>,
  writtenMetricsByMember?: Map<string, WrittenMetrics>,
  brokeredBundlingMetricsByMember?: Map<string, BrokeredBundlingMetrics>
): Promise<{ payouts: PayoutCalculation[]; warnings: string[] }> {
  // Guard against missing data
  if (!subProducerData || !Array.isArray(subProducerData)) {
    console.warn('calculateAllPayouts: subProducerData is not available');
    return { payouts: [], warnings: ['No sub-producer data provided'] };
  }
  
  const payouts: PayoutCalculation[] = [];
  const warnings: string[] = [];

  // Product term months are needed for full-term chargeback rules
  const productTermMonths = new Map<string, number>();
  const { data: productTypes, error: productTypesError } = await supabase
    .from("product_types")
    .select("name, term_months")
    .eq("agency_id", agencyId);

  if (productTypesError) {
    warnings.push(`Could not load product term months: ${productTypesError.message}`);
  } else {
    for (const productType of productTypes || []) {
      const key = String(productType.name || '').trim().toLowerCase();
      if (key) {
        productTermMonths.set(key, productType.term_months || 12);
      }
    }
  }
  
  // Create lookup maps
  const memberByCode = new Map<string, TeamMember>();
  const memberById = new Map<string, TeamMember>();
  teamMembers.forEach(tm => {
    if (tm.sub_producer_code) {
      memberByCode.set(tm.sub_producer_code.trim(), tm);
    }
    memberById.set(tm.id, tm);
  });
  
  const planById = new Map<string, CompPlan>();
  plans.forEach(p => planById.set(p.id, p));
  
  // Group assignments by team member
  const assignmentsByMember = new Map<string, string[]>();
  assignments.forEach(a => {
    const existing = assignmentsByMember.get(a.team_member_id) || [];
    existing.push(a.comp_plan_id);
    assignmentsByMember.set(a.team_member_id, existing);
  });

  // Create lookup map for manual overrides by sub-producer code
  const overrideByCode = new Map<string, ManualOverride>();
  if (manualOverrides && manualOverrides.length > 0) {
    manualOverrides.forEach(o => {
      if (o.subProdCode) {
        overrideByCode.set(o.subProdCode.trim(), o);
      }
    });
  }

  // Cache promo bonuses by team member to avoid duplicate calculations
  const promoBonusCache = new Map<string, { bonusAmount: number; achievedPromos: AchievedPromo[] }>();
  
  // Process each sub-producer's data
  for (const metrics of subProducerData) {
    const code = metrics.code.trim();
    console.log(`[calculateAllPayouts] Processing ${code}: creditInsureds=${metrics.creditInsureds?.length || 0}, chargebackInsureds=${metrics.chargebackInsureds?.length || 0}`);
    const teamMember = memberByCode.get(code);
    
    if (!teamMember) {
      warnings.push(`No team member found for sub-producer code: ${code}`);
      continue;
    }
    
    const memberPlanIds = assignmentsByMember.get(teamMember.id);
    if (!memberPlanIds || memberPlanIds.length === 0) {
      warnings.push(`No compensation plan assigned to: ${teamMember.name}`);
      continue;
    }
    
    // Calculate promo bonus once per team member (cache it)
    let promoBonus = promoBonusCache.get(teamMember.id);
    if (!promoBonus) {
      promoBonus = await calculatePromoBonus(teamMember.id, agencyId, periodMonth, periodYear);
      promoBonusCache.set(teamMember.id, promoBonus);
    }
    
    // Calculate payout for each assigned plan
    for (const planId of memberPlanIds) {
      const plan = planById.get(planId);
      if (!plan) {
        warnings.push(`Plan not found: ${planId}`);
        continue;
      }
      
      if (!plan.is_active) {
        warnings.push(`Plan "${plan.name}" is inactive, skipping`);
        continue;
      }
      
      // Convert metrics to performance with plan's chargeback rule
      const performance = convertToPerformance(
        metrics,
        teamMember.id,
        teamMember.name,
        plan.chargeback_rule,
        periodMonth,
        periodYear,
        productTermMonths
      );

      // Apply manual overrides if present (for testing compensation calculations)
      const override = overrideByCode.get(code);
      if (override) {
        // Total metrics for tier qualification
        if (override.writtenItems !== null) {
          performance.writtenItems = override.writtenItems;
        }
        if (override.writtenPremium !== null) {
          performance.writtenPremium = override.writtenPremium;
        }
        if (override.writtenPolicies !== null) {
          performance.writtenPolicies = override.writtenPolicies;
        }
        if (override.writtenHouseholds !== null) {
          performance.writtenHouseholds = override.writtenHouseholds;
        }
        if (override.writtenPoints !== null) {
          performance.writtenPoints = override.writtenPoints;
        }
        
        // Bundle breakdown for commission calculation
        // If any bundle field is specified, build a synthetic byBundleType array
        if (override.bundledItems !== null || override.monolineItems !== null ||
            override.bundledPremium !== null || override.monolinePremium !== null) {
          
          // Build synthetic byBundleType array from overrides
          performance.byBundleType = [];
          
          const bundledItems = override.bundledItems ?? 0;
          const bundledPremium = override.bundledPremium ?? 0;
          const monolineItems = override.monolineItems ?? 0;
          const monolinePremium = override.monolinePremium ?? 0;
          
          if (bundledItems > 0 || bundledPremium > 0) {
            performance.byBundleType.push({
              bundleType: 'standard', // "bundled" maps to standard in most plans
              premiumWritten: bundledPremium,
              premiumChargebacks: 0,
              netPremium: bundledPremium,
              itemsIssued: bundledItems,
              creditCount: bundledItems,
              chargebackCount: 0,
            });
          }
          
          if (monolineItems > 0 || monolinePremium > 0) {
            performance.byBundleType.push({
              bundleType: 'monoline',
              premiumWritten: monolinePremium,
              premiumChargebacks: 0,
              netPremium: monolinePremium,
              itemsIssued: monolineItems,
              creditCount: monolineItems,
              chargebackCount: 0,
            });
          }
          
          // Update issued metrics to match the bundle sum
          performance.issuedItems = bundledItems + monolineItems;
          performance.issuedPremium = bundledPremium + monolinePremium;
        }
      }

      // Get self-gen data for this team member
      const selfGenItems = selfGenByMember?.get(teamMember.id) || 0;
      const selfGenMetrics = selfGenMetricsByMember?.get(teamMember.id);
      const brokeredMetrics = brokeredMetricsByMember?.get(teamMember.id);
      const writtenMetrics = writtenMetricsByMember?.get(teamMember.id);
      const brokeredBundlingMetrics = brokeredBundlingMetricsByMember?.get(teamMember.id);

      const payout = calculateMemberPayout(
        performance,
        plan,
        periodMonth,
        periodYear,
        promoBonus,
        selfGenItems,
        selfGenMetrics,
        brokeredMetrics,
        writtenMetrics,
        brokeredBundlingMetrics
      );
      payouts.push(payout);
    }
  }
  
  return { payouts, warnings };
}
