/**
 * Business Days Utility Functions
 * Calculates projections based on Mon-Fri working days only
 */

/**
 * Check if a date is a business day (Monday-Friday)
 */
export function isBusinessDay(date: Date): boolean {
  const day = date.getDay();
  return day !== 0 && day !== 6; // Not Sunday (0) or Saturday (6)
}

/**
 * Get total number of business days in a month
 */
export function getBusinessDaysInMonth(date: Date): number {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  
  let count = 0;
  const current = new Date(firstDay);
  
  while (current <= lastDay) {
    if (isBusinessDay(current)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return count;
}

/**
 * Get number of business days elapsed from start of month to given date (inclusive)
 */
export function getBusinessDaysElapsed(date: Date): number {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  
  let count = 0;
  const current = new Date(firstDay);
  
  while (current <= date) {
    if (isBusinessDay(current)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return count;
}

/**
 * Get number of business days remaining in the month after the given date
 */
export function getBusinessDaysRemaining(date: Date): number {
  const total = getBusinessDaysInMonth(date);
  const elapsed = getBusinessDaysElapsed(date);
  return total - elapsed;
}

/**
 * Calculate projected end-of-month value based on current value and business days
 * Returns null if no business days have elapsed yet
 */
export function calculateProjection(
  currentValue: number,
  daysElapsed: number,
  totalDays: number
): number | null {
  if (daysElapsed <= 0 || totalDays <= 0) {
    return null;
  }
  
  const dailyRate = currentValue / daysElapsed;
  return Math.round(dailyRate * totalDays);
}

/**
 * Format a projection value for display
 * Uses K notation for values >= 10000
 */
export function formatProjection(value: number | null, prefix: string = ''): string {
  if (value === null) {
    return 'N/A';
  }
  
  if (value >= 10000) {
    return `${prefix}${(value / 1000).toFixed(1)}K`;
  }
  
  return `${prefix}${value.toLocaleString()}`;
}
