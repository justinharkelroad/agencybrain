import { startOfDay, getISOWeek, getISOWeekYear } from 'date-fns';

/**
 * Get UTC timestamp strings for a local date's boundaries.
 * Converts the start (00:00:00) and end (23:59:59.999) of the given
 * local date into ISO/UTC strings suitable for Supabase timestamptz queries.
 */
export function getLocalDayBoundsInUTC(localDate: Date) {
  const localStart = startOfDay(localDate);
  const localEnd = new Date(localStart);
  localEnd.setHours(23, 59, 59, 999);

  return {
    startUTC: localStart.toISOString(),
    endUTC: localEnd.toISOString(),
  };
}

/**
 * Returns an ISO 8601 week key like '2026-W11' for the given date.
 * Uses date-fns getISOWeek/getISOWeekYear for correct ISO week numbering
 * (weeks start on Monday, week 1 contains the first Thursday of the year).
 */
export function getWeekKey(date: Date): string {
  const week = getISOWeek(date);
  const year = getISOWeekYear(date);
  return `${year}-W${String(week).padStart(2, '0')}`;
}
