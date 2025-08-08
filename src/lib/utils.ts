import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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
