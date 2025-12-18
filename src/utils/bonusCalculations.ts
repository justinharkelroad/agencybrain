// Calculation utilities for the Annual Bonus Forecast Calculator

import type { 
  CalculatorInputs, 
  IntermediateValues, 
  TierResult,
  BonusTierInput 
} from '@/types/bonus-calculator';

/**
 * Compute intermediate values (baseline points and point losses)
 */
export function computeIntermediateValues(inputs: CalculatorInputs): IntermediateValues {
  // Point calculations (Auto=10pts, Home=20pts, SPL=7.5pts)
  const autoPoints = inputs.autoItemsInForce * 10;
  const homePoints = inputs.homeItemsInForce * 20;
  const splPoints = inputs.splItemsInForce * 7.5;
  
  const totalAutoHomeBaselinePoints = autoPoints + homePoints;
  const splBaselinePoints = splPoints;
  
  // Loss calculations based on retention rates (convert percentage to decimal)
  const autoRetentionDecimal = inputs.autoRetention / 100;
  const homeRetentionDecimal = inputs.homeRetention / 100;
  const splRetentionDecimal = inputs.splRetention / 100;
  
  const autoPointLoss = autoPoints * (1 - autoRetentionDecimal);
  const homePointLoss = homePoints * (1 - homeRetentionDecimal);
  const splPointLoss = splPoints * (1 - splRetentionDecimal);
  
  return {
    autoPoints,
    homePoints,
    splPoints,
    totalAutoHomeBaselinePoints,
    splBaselinePoints,
    autoPointLoss,
    homePointLoss,
    splPointLoss,
  };
}

/**
 * Calculate annual production needed for Auto & Home tiers
 */
export function calculateAutoHomeAnnualProduction(
  pgPointTarget: number,
  autoPointLoss: number,
  homePointLoss: number,
  newBusinessCushion: number,
  newBusinessRetention: number
): number {
  // Convert percentages to decimals
  const cushionDecimal = newBusinessCushion / 100;
  const retentionDecimal = newBusinessRetention / 100;
  
  return (pgPointTarget + autoPointLoss + homePointLoss) *
    (1 + cushionDecimal) *
    (1 + (1 - retentionDecimal));
}

/**
 * Calculate annual production needed for SPL tiers
 */
export function calculateSplAnnualProduction(
  pgPointTarget: number,
  splPointLoss: number,
  newBusinessCushion: number,
  newBusinessRetention: number
): number {
  // Convert percentages to decimals
  const cushionDecimal = newBusinessCushion / 100;
  const retentionDecimal = newBusinessRetention / 100;
  
  return (pgPointTarget + splPointLoss) *
    (1 + cushionDecimal) *
    (1 + (1 - retentionDecimal));
}

/**
 * Calculate a single tier row result
 */
export function calculateTierRow(
  pgPointTarget: number,
  bonusPercentage: number,
  baselinePoints: number,
  annualProductionNeeded: number,
  totalPremium: number,
  itemsProducedYTD: number,
  currentMonth: number
): TierResult {
  const growthPercentage = baselinePoints > 0 ? pgPointTarget / baselinePoints : 0;
  const estimatedBonus = totalPremium * bonusPercentage;
  const monthlyPointsNeeded = annualProductionNeeded / 12;
  const remainingMonths = 12 - currentMonth;
  
  // Calculate remaining monthly items needed
  let remainingMonthlyItems: number;
  if (remainingMonths > 0) {
    remainingMonthlyItems = (annualProductionNeeded - itemsProducedYTD) / remainingMonths;
  } else {
    remainingMonthlyItems = monthlyPointsNeeded;
  }
  
  return {
    pgPointTarget,
    growthPercentage,
    bonusPercentage,
    estimatedBonus,
    annualProductionNeeded,
    monthlyPointsNeeded,
    remainingMonthlyItems: Math.max(0, remainingMonthlyItems),
  };
}

/**
 * Calculate all Auto & Home tier results
 */
export function calculateAutoHomeGrid(
  inputs: CalculatorInputs,
  intermediate: IntermediateValues
): TierResult[] {
  return inputs.autoHomeTiers
    .filter(tier => tier.pgPointTarget > 0)
    .map(tier => {
      const annualProduction = calculateAutoHomeAnnualProduction(
        tier.pgPointTarget,
        intermediate.autoPointLoss,
        intermediate.homePointLoss,
        inputs.newBusinessCushion,
        inputs.newBusinessRetention
      );
      
      return calculateTierRow(
        tier.pgPointTarget,
        tier.bonusPercentage,
        intermediate.totalAutoHomeBaselinePoints,
        annualProduction,
        inputs.estimatedYearEndPremium,
        inputs.itemsProducedYTD,
        inputs.currentMonth
      );
    });
}

/**
 * Calculate all SPL tier results
 */
export function calculateSplGrid(
  inputs: CalculatorInputs,
  intermediate: IntermediateValues
): TierResult[] {
  return inputs.splTiers
    .filter(tier => tier.pgPointTarget > 0)
    .map(tier => {
      const annualProduction = calculateSplAnnualProduction(
        tier.pgPointTarget,
        intermediate.splPointLoss,
        inputs.newBusinessCushion,
        inputs.newBusinessRetention
      );
      
      return calculateTierRow(
        tier.pgPointTarget,
        tier.bonusPercentage,
        intermediate.splBaselinePoints,
        annualProduction,
        inputs.estimatedYearEndPremium,
        inputs.itemsProducedYTD,
        inputs.currentMonth
      );
    });
}

/**
 * Calculate combined totals grid (Auto/Home + SPL for each tier index)
 */
export function calculateCombinedGrid(
  autoHomeResults: TierResult[],
  splResults: TierResult[]
): TierResult[] {
  // Combine matching tier indices
  const maxLength = Math.max(autoHomeResults.length, splResults.length);
  const combined: TierResult[] = [];
  
  for (let i = 0; i < maxLength; i++) {
    const ah = autoHomeResults[i];
    const spl = splResults[i];
    
    if (ah && spl) {
      combined.push({
        pgPointTarget: ah.pgPointTarget + spl.pgPointTarget,
        growthPercentage: 0, // Not meaningful for combined
        bonusPercentage: ah.bonusPercentage + spl.bonusPercentage,
        estimatedBonus: ah.estimatedBonus + spl.estimatedBonus,
        annualProductionNeeded: ah.annualProductionNeeded + spl.annualProductionNeeded,
        monthlyPointsNeeded: ah.monthlyPointsNeeded + spl.monthlyPointsNeeded,
        remainingMonthlyItems: ah.remainingMonthlyItems + spl.remainingMonthlyItems,
      });
    } else if (ah) {
      combined.push({ ...ah });
    } else if (spl) {
      combined.push({ ...spl });
    }
  }
  
  return combined;
}

/**
 * Format currency for display
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Format percentage for display
 */
export function formatPercentage(value: number, decimals: number = 2): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Format number with commas
 */
export function formatNumber(value: number, decimals: number = 0): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}
