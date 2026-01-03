import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Parses a YYYY-MM-DD string as a local date (not UTC) to prevent day shift
export function parseDateLocal(value: string | null | undefined): Date | null {
  if (!value) return null;
  const s = String(value);
  const match = /^([0-9]{4})-([0-9]{2})-([0-9]{2})/.exec(s);
  if (match) {
    const [, y, m, d] = match;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  return new Date(s);
}

// Format number with commas
export function formatNumber(n: number | undefined | null): string {
  if (n === null || n === undefined || isNaN(Number(n))) return '0';
  return new Intl.NumberFormat().format(Number(n));
}

// Format currency with commas and cents conversion
export function formatCurrency(cents: number | undefined | null): string {
  if (cents === null || cents === undefined || isNaN(Number(cents))) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(Number(cents) / 100); // Convert cents to dollars
}

// Formats a Postgres DATE (YYYY-MM-DD) or Date into a formatted string without UTC shift
// Uses date-fns format strings (e.g., "MMM d, yyyy" for "Jan 3, 2026")
export function formatDateLocal(
  value: string | Date | null | undefined,
  formatStr: string = "MMM d, yyyy"
): string {
  if (!value) return "";

  let d: Date;
  if (value instanceof Date) {
    d = value;
  } else {
    const s = String(value);
    // If it's a bare date (YYYY-MM-DD), parse as local date to avoid UTC offset issues
    const match = /^([0-9]{4})-([0-9]{2})-([0-9]{2})/.exec(s);
    if (match) {
      const [, y, m, day] = match;
      d = new Date(Number(y), Number(m) - 1, Number(day));
    } else {
      // Fallback for full ISO strings or other formats
      d = new Date(s);
    }
  }

  if (isNaN(d.getTime())) return "";
  try {
    return format(d, formatStr);
  } catch {
    return "";
  }
}

// Validate standard UUID v1-v5
export function isValidUUID(v: string | null | undefined): boolean {
  if (!v) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

// Creates a Date at local midnight for a given date (fixes react-day-picker UTC issue)
export function toLocalDate(date: Date | undefined): Date | undefined {
  if (!date) return undefined;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

// Creates today's date at local midnight
export function todayLocal(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

