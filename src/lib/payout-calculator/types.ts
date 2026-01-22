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
