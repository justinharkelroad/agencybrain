export interface RoyParams {
  ytdItemsTotal: number;
  reportMonth: number; // 1..12
  oldMonthlyItemsByTier: number[]; // J38-J44 values from grid
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

// Tier labels corresponding to H38-H44 bonus percentages
const TIER_LABELS = ['4.0%', '3.5%', '3.0%', '2.5%', '2.0%', '1.0%', '0.05%'];

export function computeRoyTargets(params: RoyParams): RoyResult {
  const { ytdItemsTotal, reportMonth, oldMonthlyItemsByTier, m25, dailyMode } = params;
  
  const monthsElapsed = reportMonth;
  const monthsRemaining = Math.max(1, 12 - monthsElapsed);
  const paceItemsPerMonth = ytdItemsTotal / monthsElapsed;
  
  const tiers: RoyTierResult[] = oldMonthlyItemsByTier.map((oldItems, index) => {
    // Calculate annual goal based on old monthly items
    const annualGoalItems = 12 * oldItems;
    
    // Calculate remaining items needed to reach annual goal
    const remainingItems = Math.max(0, annualGoalItems - ytdItemsTotal);
    
    // Calculate new monthly items needed for rest of year
    const newMonthlyItemsExact = remainingItems / monthsRemaining;
    const newMonthlyItemsCeiling = Math.ceil(newMonthlyItemsExact);
    
    // Calculate delta
    const deltaItemsPerMonth = newMonthlyItemsExact - oldItems;
    
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
    
    return {
      tierLabel: TIER_LABELS[index] || `Tier ${index + 1}`,
      oldMonthlyItems: oldItems,
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