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

// Default tier structures
export const DEFAULT_AUTO_HOME_TIERS: BonusTierInput[] = [
  { bonusPercentage: 0.030, pgPointTarget: 0 },  // 3.0%
  { bonusPercentage: 0.025, pgPointTarget: 0 },  // 2.5%
  { bonusPercentage: 0.020, pgPointTarget: 0 },  // 2.0%
  { bonusPercentage: 0.015, pgPointTarget: 0 },  // 1.5%
  { bonusPercentage: 0.010, pgPointTarget: 0 },  // 1.0%
  { bonusPercentage: 0.005, pgPointTarget: 0 },  // 0.5%
  { bonusPercentage: 0.0005, pgPointTarget: 0 }, // 0.05%
];

export const DEFAULT_SPL_TIERS: BonusTierInput[] = [
  { bonusPercentage: 0.010, pgPointTarget: 0 },  // 1.0%
  { bonusPercentage: 0.008, pgPointTarget: 0 },  // 0.8%
  { bonusPercentage: 0.006, pgPointTarget: 0 },  // 0.6%
  { bonusPercentage: 0.0045, pgPointTarget: 0 }, // 0.45%
  { bonusPercentage: 0.003, pgPointTarget: 0 },  // 0.3%
  { bonusPercentage: 0.0015, pgPointTarget: 0 }, // 0.15%
  { bonusPercentage: 0.0005, pgPointTarget: 0 }, // 0.05%
];

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
