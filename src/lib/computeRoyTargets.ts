export interface RoyParams {
  ytdItemsTotal: number;
  reportMonth: number; // 1..12
  oldMonthlyItemsByTier: number[]; // J38-J44 values from grid
  bonusPercentages: number[]; // H38-H44 values from grid
  m25?: number; // Points/Items Mix for optional points calculations
  dailyMode: '21-day' | 'business';
}

export interface RoyTierResult {
  tierLabel: string;
  oldMonthlyItems: number;
  newMonthlyItemsExact: number;
  newMonthlyItemsCeiling: number;
  deltaItemsPerMonth: number;
  // Optional points calculations
  newMonthlyPoints?: number;
  newDailyItems21?: number;
  newDailyPoints21?: number;
}

export interface RoyResult {
  monthsElapsed: number;
  monthsRemaining: number;
  paceItemsPerMonth: number;
  tiers: RoyTierResult[];
}

export function computeRoyTargets(params: RoyParams): RoyResult {
  const { ytdItemsTotal, reportMonth, oldMonthlyItemsByTier, bonusPercentages, m25, dailyMode } = params;
  
  const monthsElapsed = reportMonth;
  const monthsRemaining = Math.max(1, 12 - monthsElapsed);
  const paceItemsPerMonth = ytdItemsTotal / monthsElapsed;
  
  const tiers: RoyTierResult[] = oldMonthlyItemsByTier.map((oldTarget, index) => {
    // Old Target: Monthly Items Needed from grid (J38-J44) - rounded to whole number
    const oldMonthlyItems = Math.round(oldTarget);
    
    // Calculate annual goal based on rounded old target
    const annualGoalItems = oldMonthlyItems * 12;
    
    // Calculate remaining items needed to reach annual goal
    const itemsStillNeeded = Math.max(0, annualGoalItems - ytdItemsTotal);
    
    // New Target: Rest-of-year adjusted target - rounded to whole number
    const newMonthlyItemsExact = itemsStillNeeded / monthsRemaining;
    const newMonthlyItemsCeiling = Math.round(newMonthlyItemsExact);
    
    // Change: Simple difference between rounded new and old targets
    const deltaItemsPerMonth = newMonthlyItemsCeiling - oldMonthlyItems;
    
    // Optional calculations for points view
    let newMonthlyPoints: number | undefined;
    let newDailyItems21: number | undefined;
    let newDailyPoints21: number | undefined;
    
    if (m25 !== undefined) {
      newMonthlyPoints = newMonthlyItemsExact * m25;
      if (dailyMode === '21-day') {
        newDailyItems21 = newMonthlyItemsExact / 21;
        newDailyPoints21 = newMonthlyPoints / 21;
      }
      // Business day mode not implemented yet - leave as undefined
    }
    
    // Format bonus percentage as tier label
    const percentage = bonusPercentages[index] || 0;
    const tierLabel = `${(percentage * 100).toFixed(percentage >= 0.01 ? 1 : 2)}%`;
    
    return {
      tierLabel,
      oldMonthlyItems,
      newMonthlyItemsExact,
      newMonthlyItemsCeiling,
      deltaItemsPerMonth,
      newMonthlyPoints,
      newDailyItems21,
      newDailyPoints21,
    };
  });
  
  return {
    monthsElapsed,
    monthsRemaining,
    paceItemsPerMonth,
    tiers,
  };
}