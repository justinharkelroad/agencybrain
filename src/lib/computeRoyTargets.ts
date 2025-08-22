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
  
  const tiers: RoyTierResult[] = oldMonthlyItemsByTier.map((targetMonthlyItems, index) => {
    // Current monthly pace is the same for all tiers
    const currentMonthlyPace = paceItemsPerMonth;
    
    // Target monthly pace is from J38-J44 (Monthly Items Needed)
    const targetMonthlyPace = targetMonthlyItems;
    
    // Calculate the change needed per month
    const deltaItemsPerMonth = targetMonthlyPace - currentMonthlyPace;
    
    // For display purposes, use target as "new" and current as "old"
    const newMonthlyItemsExact = targetMonthlyPace;
    const newMonthlyItemsCeiling = Math.ceil(newMonthlyItemsExact);
    
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
      oldMonthlyItems: currentMonthlyPace,
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