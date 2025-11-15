/**
 * Quarter utilities for handling YYYY-QX format
 */

export type QuarterPart = 'Q1' | 'Q2' | 'Q3' | 'Q4';

export interface ParsedQuarter {
  year: number;
  quarter: QuarterPart;
}

/**
 * Parse a quarter string (e.g., "2026-Q1") into year and quarter parts
 */
export function parseQuarter(quarter: string): ParsedQuarter {
  const match = quarter.match(/^(\d{4})-Q([1-4])$/);
  if (!match) {
    throw new Error(`Invalid quarter format: ${quarter}. Expected YYYY-QX`);
  }
  return {
    year: parseInt(match[1], 10),
    quarter: `Q${match[2]}` as QuarterPart,
  };
}

/**
 * Format year and quarter into YYYY-QX string
 */
export function formatQuarter(year: number, quarter: QuarterPart): string {
  return `${year}-${quarter}`;
}

/**
 * Get the current quarter in YYYY-QX format
 */
export function getCurrentQuarter(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  
  if (month <= 3) return `${year}-Q1`;
  if (month <= 6) return `${year}-Q2`;
  if (month <= 9) return `${year}-Q3`;
  return `${year}-Q4`;
}

/**
 * Get the next quarter after the given quarter
 */
export function getNextQuarter(current: string): string {
  const { year, quarter } = parseQuarter(current);
  
  switch (quarter) {
    case 'Q1': return formatQuarter(year, 'Q2');
    case 'Q2': return formatQuarter(year, 'Q3');
    case 'Q3': return formatQuarter(year, 'Q4');
    case 'Q4': return formatQuarter(year + 1, 'Q1');
  }
}

/**
 * Get the previous quarter before the given quarter
 */
export function getPreviousQuarter(current: string): string {
  const { year, quarter } = parseQuarter(current);
  
  switch (quarter) {
    case 'Q1': return formatQuarter(year - 1, 'Q4');
    case 'Q2': return formatQuarter(year, 'Q1');
    case 'Q3': return formatQuarter(year, 'Q2');
    case 'Q4': return formatQuarter(year, 'Q3');
  }
}

/**
 * Get an array of available quarters for selection (past 2 and future 4)
 */
export function getAvailableQuarters(): string[] {
  const current = getCurrentQuarter();
  const quarters: string[] = [];
  
  // Add 2 past quarters
  let quarter = getPreviousQuarter(getPreviousQuarter(current));
  
  // Add 7 quarters total (2 past + current + 4 future)
  for (let i = 0; i < 7; i++) {
    quarters.push(quarter);
    quarter = getNextQuarter(quarter);
  }
  
  return quarters;
}

/**
 * Format quarter for display (e.g., "Q1 2026")
 */
export function formatQuarterDisplay(quarter: string): string {
  const { year, quarter: q } = parseQuarter(quarter);
  return `${q} ${year}`;
}

/**
 * Check if a quarter string is in the new format (YYYY-QX)
 */
export function isNewFormat(quarter: string): boolean {
  return /^\d{4}-Q[1-4]$/.test(quarter);
}

/**
 * Migrate old format (Q1) to new format (YYYY-QX) using current year
 */
export function migrateOldFormat(quarter: string): string {
  if (isNewFormat(quarter)) {
    return quarter;
  }
  
  // Assume current year for old format
  const year = new Date().getFullYear();
  return `${year}-${quarter}`;
}
