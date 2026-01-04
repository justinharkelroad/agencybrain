// Types for payout calculation engine

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
  
  // Chargebacks
  chargebackPremium: number;
  chargebackCount: number;
  
  // Net
  netPremium: number;
  netItems: number;
}

export interface TierMatch {
  tierId: string;
  minThreshold: number;
  commissionValue: number;
  metricValue: number;
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
  
  // Chargebacks
  chargebackPremium: number;
  chargebackCount: number;
  
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
  
  // Rollover
  rolloverPremium: number;
  
  // Status
  status: 'draft' | 'finalized' | 'paid';
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
