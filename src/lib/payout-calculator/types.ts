// Types for payout calculation engine

import { SubProducerTransaction, InsuredAggregate, BundleTypeBreakdown, ProductBreakdown } from '@/lib/allstate-analyzer/sub-producer-analyzer';

export interface SubProducerPerformance {
  subProdCode: string;
  teamMemberId: string | null;
  teamMemberName: string | null;
  
  // Written metrics (used for tier calculation)
  writtenPremium: number;
  writtenItems: number;
  writtenPolicies: number;
  writtenHouseholds: number;
  writtenPoints: number;
  
  // Issued metrics (used for payout calculation)
  issuedPremium: number;
  issuedItems: number;
  issuedPolicies: number;
  issuedPoints: number;
  
  // Chargebacks (all)
  chargebackPremium: number;
  chargebackCount: number;
  
  // 3-Month Rule filtered chargebacks
  eligibleChargebackPremium: number;  // Only chargebacks where policy < 90 days
  eligibleChargebackCount: number;
  excludedChargebackCount: number;    // Chargebacks excluded (policy > 90 days)
  
  // Net
  netPremium: number;
  netItems: number;
  
  // Raw data for detail views
  creditInsureds: InsuredAggregate[];
  chargebackInsureds: InsuredAggregate[];
  creditTransactions: SubProducerTransaction[];
  chargebackTransactions: SubProducerTransaction[];

  // Breakdowns for advanced compensation calculation
  byBundleType: BundleTypeBreakdown[];
  byProduct: ProductBreakdown[];
}

export interface TierMatch {
  tierId: string;
  minThreshold: number;
  commissionValue: number;
  metricValue: number;
}

export interface AchievedPromo {
  promoId: string;
  promoName: string;
  bonusAmount: number;
  targetValue: number;
  achievedValue: number;
}

export interface PayoutCalculation {
  teamMemberId: string;
  teamMemberName: string;
  compPlanId: string;
  compPlanName: string;
  periodMonth: number;
  periodYear: number;
  
  // Written metrics (for tier)
  writtenPremium: number;
  writtenItems: number;
  writtenPolicies: number;
  writtenHouseholds: number;
  writtenPoints: number;
  
  // Issued metrics (for payout)
  issuedPremium: number;
  issuedItems: number;
  issuedPolicies: number;
  issuedPoints: number;
  
  // Chargebacks (all)
  chargebackPremium: number;
  chargebackCount: number;
  
  // 3-Month Rule tracking
  eligibleChargebackPremium: number;
  eligibleChargebackCount: number;
  excludedChargebackCount: number;
  chargebackRule: string;
  
  // Net
  netPremium: number;
  netItems: number;
  
  // Tier achieved
  tierMatch: TierMatch | null;
  tierThresholdMet: number;
  tierCommissionValue: number;
  
  // Commission calculation
  baseCommission: number;
  bonusAmount: number;
  totalPayout: number;

  // Commission breakdown by bundle type (when bundle_configs is used)
  commissionByBundleType?: Array<{
    bundleType: string;
    premium: number;
    items: number;
    commission: number;
  }>;

  // Commission breakdown by product (when product_rates is used)
  commissionByProduct?: Array<{
    product: string;
    premium: number;
    items: number;
    commission: number;
  }>;

  // Extended modifier tracking (Phase 2)
  customPointsCalculated?: number; // Points calculated using custom point_values
  bundlingPercent?: number; // Percentage of bundled policies
  bundlingMultiplier?: number; // Multiplier applied (1.0 = none)
  selfGenPercent?: number; // Percentage of self-generated leads
  selfGenKickerAmount?: number; // Bonus from self-gen kicker

  // Self-gen penalty/bonus tracking (Phase 3)
  selfGenMetRequirement?: boolean;
  selfGenPenaltyAmount?: number;
  selfGenBonusAmount?: number;

  // Brokered commission (Phase 5)
  brokeredCommission?: number;

  // Chargeback details (Phase 4)
  chargebackDetails?: ChargebackDetail[];

  // Full calculation snapshot for audit (Phase 8)
  calculationSnapshot?: CalculationSnapshot;

  // Promo bonuses
  achievedPromos: AchievedPromo[];
  
  // Rollover
  rolloverPremium: number;
  
  // Status
  status: 'draft' | 'finalized' | 'paid';
  
  // Raw data for detail views
  creditInsureds: InsuredAggregate[];
  chargebackInsureds: InsuredAggregate[];
}

export interface PayoutPeriod {
  month: number;
  year: number;
}

export interface CalculationResult {
  success: boolean;
  payouts: PayoutCalculation[];
  errors: string[];
  warnings: string[];
}

// ============================================
// Self-Gen Penalty/Bonus Types (Phase 3)
// ============================================

export interface SelfGenRequirement {
  enabled: boolean;
  min_percent: number;
  source: 'written' | 'issued';
  penalty_type: 'percent_reduction' | 'flat_reduction' | 'tier_demotion';
  penalty_value: number;
}

export interface SelfGenBonus {
  enabled: boolean;
  min_percent: number;
  bonus_type: 'percent_boost' | 'flat_bonus' | 'per_item' | 'per_policy' | 'per_household' | 'tier_promotion';
  bonus_value: number;
}

export interface SelfGenPenaltyResult {
  applied: boolean;
  penaltyType: 'percent_reduction' | 'flat_reduction' | 'tier_demotion' | null;
  penaltyValue: number;
  originalTierIndex: number | null;
  adjustedTierIndex: number | null;
  commissionReduction: number;
}

export interface SelfGenBonusResult {
  applied: boolean;
  bonusType: string | null;
  bonusValue: number;
  bonusAmount: number;
  tierPromotion: number;
}

// ============================================
// Chargeback Detail Types (Phase 4)
// ============================================

export interface ChargebackDetail {
  policyNumber: string;
  productType: string;
  premium: number;
  daysInForce: number;
  termMonths: number;
  included: boolean;
  reason: string;
}

export interface ChargebackFilterResult {
  eligibleChargebacks: SubProducerTransaction[];
  excludedChargebacks: SubProducerTransaction[];
  eligiblePremium: number;
  excludedPremium: number;
  details: ChargebackDetail[];
}

// ============================================
// Calculation Snapshot (Phase 8 - Audit Trail)
// ============================================

export interface CalculationSnapshot {
  inputs: {
    writtenItems: number;
    writtenPremium: number;
    issuedItems: number;
    issuedPremium: number;
    chargebackCount: number;
    chargebackPremium: number;
    tierMetric: string;
    tierMetricSource: string;
    chargebackRule: string;
  };
  tierMatched: {
    tierId: string;
    threshold: number;
    rate: number;
  } | null;
  selfGen: {
    percent: number;
    metRequirement: boolean;
    penaltyApplied: boolean;
    penaltyAmount: number;
    bonusApplied: boolean;
    bonusAmount: number;
  };
  bundling: {
    percent: number;
    multiplier: number;
  };
  calculations: {
    baseBeforeModifiers: number;
    selfGenPenalty: number;
    selfGenBonus: number;
    bundlingBoost: number;
    brokeredCommission: number;
    promoBonus: number;
    finalTotal: number;
  };
  calculatedAt: string;
}

// ============================================
// Written Metrics (from sales table for tier qualification)
// ============================================

/**
 * Written metrics from the sales table.
 * Used for tier qualification when tier_metric_source = 'written'.
 * This represents manually entered sales data, not Allstate statement data.
 */
export interface WrittenMetrics {
  writtenItems: number;
  writtenPremium: number;
  writtenPolicies: number;
  writtenHouseholds: number;
}

/**
 * Brokered bundling metrics for bundling % calculation.
 * Includes brokered sales where brokered_counts_toward_bundling = true.
 */
export interface BrokeredBundlingMetrics {
  bundledItems: number;      // Items in Standard + Preferred bundles
  bundledHouseholds: number; // Households in Standard + Preferred bundles
  totalItems: number;        // All brokered items marked for bundling (for denominator)
}
