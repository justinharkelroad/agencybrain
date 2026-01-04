// Types for payout calculation engine

import { SubProducerTransaction, InsuredAggregate } from '@/lib/allstate-analyzer/sub-producer-analyzer';

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
