/**
 * Business Days Utility for Edge Functions
 * Reusable logic for skipping automated emails on non-business days
 */

/**
 * Check if a date is a business day (Monday-Friday)
 */
export function isBusinessDay(date: Date): boolean {
  const day = date.getDay();
  return day !== 0 && day !== 6; // Not Sunday (0) or Saturday (6)
}

/**
 * Check if we should send daily summary emails today.
 * Returns false on Sunday (would report Sat) and Monday (would report Sun).
 * @param today - Current date
 * @returns true if yesterday was a business day
 */
export function shouldSendDailySummary(today: Date): boolean {
  const dayOfWeek = today.getDay();
  // Skip Sunday (0) - would report on Saturday
  // Skip Monday (1) - would report on Sunday
  return dayOfWeek !== 0 && dayOfWeek !== 1;
}

/**
 * Get the previous business day from a given date
 * Useful for features that need to skip weekends
 */
export function getPreviousBusinessDay(date: Date): Date {
  const result = new Date(date);
  result.setDate(result.getDate() - 1);
  
  // If Saturday, go back to Friday
  if (result.getDay() === 6) {
    result.setDate(result.getDate() - 1);
  }
  // If Sunday, go back to Friday
  else if (result.getDay() === 0) {
    result.setDate(result.getDate() - 2);
  }
  
  return result;
}

/**
 * Get the day name for logging purposes
 */
export function getDayName(date: Date): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[date.getDay()];
}
