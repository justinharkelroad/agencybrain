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

/**
 * Get months for a quarter string (e.g., "2026-Q1" or "Q1")
 */
function getMonthsForQuarter(quarter: string): string[] {
  const q = quarter.toUpperCase();
  if (q.includes('Q1')) return ['January', 'February', 'March'];
  if (q.includes('Q2')) return ['April', 'May', 'June'];
  if (q.includes('Q3')) return ['July', 'August', 'September'];
  if (q.includes('Q4')) return ['October', 'November', 'December'];
  return ['Month 1', 'Month 2', 'Month 3'];
}

/**
 * Remap monthly missions from one quarter's months to another
 * This function ensures missions are mapped to the correct months based on position,
 * not the existing month keys (which might be wrong)
 */
export function remapMonthlyMissions(
  missions: any,
  fromQuarter: string,
  toQuarter: string
): any {
  if (!missions || typeof missions !== 'object') return missions;
  
  const fromMonths = getMonthsForQuarter(fromQuarter);
  const toMonths = getMonthsForQuarter(toQuarter);
  
  // If quarters have same months, no remapping needed
  if (fromMonths[0] === toMonths[0]) return missions;
  
  const remapped: any = {};
  
  // For each target (target1, target2)
  Object.keys(missions).forEach(targetKey => {
    if (missions[targetKey] && typeof missions[targetKey] === 'object') {
      remapped[targetKey] = {};
      
      // Get all month entries and sort them by their position in the expected months
      const monthEntries = Object.entries(missions[targetKey]);
      
      // Sort by the position in fromMonths to preserve chronological order
      const sortedEntries = monthEntries.sort((a, b) => {
        const indexA = fromMonths.indexOf(a[0]);
        const indexB = fromMonths.indexOf(b[0]);
        // If month not found in expected list, use original order
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
      });
      
      // Map to new months in order
      sortedEntries.forEach(([_, value], index) => {
        if (index < toMonths.length) {
          remapped[targetKey][toMonths[index]] = value;
        }
      });
    }
  });
  
  return remapped;
}
