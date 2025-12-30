// Types for the Annual Bonus Forecast Calculator

export interface BonusTierInput {
  bonusPercentage: number; // Fixed: 0.03, 0.025, 0.02, etc.
  pgPointTarget: number;   // User enters this
}

export interface CalculatorInputs {
  // Premium
  estimatedYearEndPremium: number;

  // Auto
  autoItemsInForce: number;
  autoPremiumWritten: number;
  autoRetention: number;

  // Home
  homeItemsInForce: number;
  homePremiumWritten: number;
  homeRetention: number;

  // SPL
  splItemsInForce: number;
  splPremiumWritten: number;
  splRetention: number;

  // Factors
  newBusinessRetention: number;
  newBusinessCushion: number;

  // Progress
  itemsProducedYTD: number;
  currentMonth: number;

  // PG Targets (user customizable)
  autoHomeTiers: BonusTierInput[]; // 7 tiers
  splTiers: BonusTierInput[];      // 7 tiers
}

export interface TierResult {
  pgPointTarget: number;
  growthPercentage: number;
  bonusPercentage: number;
  estimatedBonus: number;
  annualProductionNeeded: number;   // Points
  monthlyPointsNeeded: number;      // Points (full-year average)
  remainingMonthlyItems: number;    // Points (remaining months)
  // NEW: Items-based metrics
  annualItemsNeeded: number;        // Annual production in ITEMS
  monthlyItemsNeeded: number;       // Full-year average items/month (THE KEY METRIC)
  remainingMonthlyItemsCount: number; // Items needed per remaining month
}

export interface IntermediateValues {
  // Point calculations
  autoPoints: number;
  homePoints: number;
  splPoints: number;
  totalAutoHomeBaselinePoints: number;
  splBaselinePoints: number;
  
  // Loss calculations
  autoPointLoss: number;
  homePointLoss: number;
  splPointLoss: number;
  
  // NEW: Baseline items (raw item counts)
  autoHomeBaselineItems: number;    // Auto + Home items count
  splBaselineItems: number;         // SPL items count
  totalBaselineItems: number;       // Combined total items
  
  // NEW: Points per item ratios
  autoHomePointsPerItem: number;    // Weighted average for A+H
  splPointsPerItem: number;         // Always 7.5
  combinedPointsPerItem: number;    // Weighted for combined view
}

export interface CombinedTierResult extends TierResult {
  autoHomeBonusPercent: number;
  splBonusPercent: number;
}
// HARDCODED TIER PERCENTAGES - These are Allstate industry-standard values
// Identical for every agency nationwide - NEVER extracted or editable
// Only PG Point Targets vary by agency

export const AUTO_HOME_TIER_PERCENTAGES = [
  0.0005,  // 0.05% (Tier 1 - lowest)
  0.005,   // 0.50% (Tier 2)
  0.010,   // 1.00% (Tier 3)
  0.015,   // 1.50% (Tier 4)
  0.020,   // 2.00% (Tier 5)
  0.025,   // 2.50% (Tier 6)
  0.030,   // 3.00% (Tier 7 - highest)
] as const;

export const SPL_TIER_PERCENTAGES = [
  0.0005,  // 0.05% (Tier 1 - lowest)
  0.0015,  // 0.15% (Tier 2)
  0.003,   // 0.30% (Tier 3)
  0.0045,  // 0.45% (Tier 4)
  0.006,   // 0.60% (Tier 5)
  0.008,   // 0.80% (Tier 6)
  0.010,   // 1.00% (Tier 7 - highest)
] as const;

// Default tier structures - combine hardcoded percentages with zero targets
export const DEFAULT_AUTO_HOME_TIERS: BonusTierInput[] = AUTO_HOME_TIER_PERCENTAGES.map(
  (bonusPercentage) => ({ bonusPercentage, pgPointTarget: 0 })
);

export const DEFAULT_SPL_TIERS: BonusTierInput[] = SPL_TIER_PERCENTAGES.map(
  (bonusPercentage) => ({ bonusPercentage, pgPointTarget: 0 })
);

export const DEFAULT_INPUTS: CalculatorInputs = {
  estimatedYearEndPremium: 16000000,
  autoItemsInForce: 0,
  autoPremiumWritten: 0,
  autoRetention: 85,
  homeItemsInForce: 0,
  homePremiumWritten: 0,
  homeRetention: 88,
  splItemsInForce: 0,
  splPremiumWritten: 0,
  splRetention: 83,
  newBusinessRetention: 87,
  newBusinessCushion: 10,
  itemsProducedYTD: 0,
  currentMonth: 1,
  autoHomeTiers: [...DEFAULT_AUTO_HOME_TIERS],
  splTiers: [...DEFAULT_SPL_TIERS],
};
