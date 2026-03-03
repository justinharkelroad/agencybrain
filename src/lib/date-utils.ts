import { startOfDay } from 'date-fns';

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
