import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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

// Formats a Postgres DATE (YYYY-MM-DD) or Date into a local date string without UTC shift
export function formatDateLocal(
  value: string | Date | null | undefined,
  locale?: string | string[]
): string {
  if (!value) return "";

  let d: Date;
  if (value instanceof Date) {
    d = value;
  } else {
    const s = String(value);
    // If it's a bare date (YYYY-MM-DD), parse as local date to avoid UTC offset issues
    const match = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(s);
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
    return d.toLocaleDateString(locale || undefined);
  } catch {
    return d.toLocaleDateString();
  }
}
