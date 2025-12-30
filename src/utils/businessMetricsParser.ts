import * as XLSX from 'xlsx';

export interface BusinessMetricsExtraction {
  estimatedYearEndPremium: number;
  autoItemsInForce: number;
  autoPremiumWritten: number;
  autoRetention: number;
  homeItemsInForce: number;
  homePremiumWritten: number;
  homeRetention: number;
  splItemsInForce: number;
  splPremiumWritten: number;
  splRetention: number;
  newBusinessRetention: number;
}

// Column indices based on actual XLSX structure:
// 0: Business Metrics (row labels)
// 1: Standard Auto
// 2: Non Standard Auto
// 3: Speciality Auto
// 4: Homeowners
// 5: Renters
// 6: Condo
// 7: Other Special Property
// 8: Total Personal Lines
// 9: ABI Voluntary Auto
// 10: ABI - Non Auto
// 11: Total Property & Casualty
const COLUMN_INDICES = {
  standardAuto: 1,
  homeowners: 4,
  splColumns: [3, 5, 6, 7], // Speciality Auto, Renters, Condo, Other Special Property
  totalPC: 11,
} as const;

// Row labels to search for (exact match in column 0)
const ROW_LABELS = {
  currentMonthTotal: 'current month total',
  netRetention: 'net retention',
  zeroToTwoYears: '0-2 years',
  ytdTotal: 'ytd - total',
  earnedPremium12MM: 'earned premium - 12mm',
} as const;

// Helper: Parse currency string to number
function parseCurrency(value: unknown): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  // Remove $, commas, and handle negatives in parentheses
  const str = String(value).replace(/[$,]/g, '').replace(/\((.+)\)/, '-$1');
  return parseFloat(str) || 0;
}

// Helper: Parse percentage string to number (returns decimal like 81.95)
function parsePercentage(value: unknown): number {
  if (typeof value === 'number') {
    // If it's already a decimal like 0.8195, convert to percentage
    return value < 1 && value > 0 ? value * 100 : value;
  }
  if (!value) return 0;
  const str = String(value).replace('%', '').trim();
  return parseFloat(str) || 0;
}

// Helper: Parse integer (for items in force)
function parseInteger(value: unknown): number {
  if (typeof value === 'number') return Math.round(value);
  if (!value) return 0;
  const str = String(value).replace(/[,$]/g, '').trim();
  return parseInt(str, 10) || 0;
}

export async function parseBusinessMetricsXLSX(file: File): Promise<BusinessMetricsExtraction | null> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    
    // Use first sheet (Business Metrics Printable View)
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // Convert to array of arrays (rows)
    const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    console.log('Parsing XLSX, total rows:', rows.length);
    
    // Helper: Find row by label in column 0 (case-insensitive)
    const findRow = (label: string): unknown[] | null => {
      const row = rows.find(r => {
        const cellValue = String((r as unknown[])[0] || '').trim().toLowerCase();
        return cellValue === label.toLowerCase();
      });
      if (row) {
        console.log(`Found row "${label}":`, row);
      } else {
        console.log(`Row "${label}" NOT FOUND`);
      }
      return (row as unknown[]) || null;
    };
    
    // Find the key rows
    const currentMonthTotalRow = findRow(ROW_LABELS.currentMonthTotal);
    const netRetentionRow = findRow(ROW_LABELS.netRetention);
    const zeroToTwoYearsRow = findRow(ROW_LABELS.zeroToTwoYears);
    const ytdTotalRow = findRow(ROW_LABELS.ytdTotal);
    const earnedPremium12MMRow = findRow(ROW_LABELS.earnedPremium12MM);
    
    // Extract values using exact column indices
    const result: BusinessMetricsExtraction = {
      // Year End Premium: Earned Premium - 12MM, Column 11 (Total P&C)
      estimatedYearEndPremium: earnedPremium12MMRow 
        ? parseCurrency(earnedPremium12MMRow[COLUMN_INDICES.totalPC]) 
        : 0,
      
      // Auto: Column 1 (Standard Auto)
      autoItemsInForce: currentMonthTotalRow 
        ? parseInteger(currentMonthTotalRow[COLUMN_INDICES.standardAuto]) 
        : 0,
      autoPremiumWritten: ytdTotalRow 
        ? parseCurrency(ytdTotalRow[COLUMN_INDICES.standardAuto]) 
        : 0,
      autoRetention: netRetentionRow 
        ? parsePercentage(netRetentionRow[COLUMN_INDICES.standardAuto]) 
        : 0,
      
      // Home: Column 4 (Homeowners)
      homeItemsInForce: currentMonthTotalRow 
        ? parseInteger(currentMonthTotalRow[COLUMN_INDICES.homeowners]) 
        : 0,
      homePremiumWritten: ytdTotalRow 
        ? parseCurrency(ytdTotalRow[COLUMN_INDICES.homeowners]) 
        : 0,
      homeRetention: netRetentionRow 
        ? parsePercentage(netRetentionRow[COLUMN_INDICES.homeowners]) 
        : 0,
      
      // SPL: SUM of Columns 3, 5, 6, 7 (Speciality Auto, Renters, Condo, Other Special Property)
      splItemsInForce: currentMonthTotalRow 
        ? COLUMN_INDICES.splColumns.reduce((sum, col) => sum + parseInteger(currentMonthTotalRow[col]), 0)
        : 0,
      splPremiumWritten: ytdTotalRow 
        ? COLUMN_INDICES.splColumns.reduce((sum, col) => sum + parseCurrency(ytdTotalRow[col]), 0)
        : 0,
      splRetention: netRetentionRow 
        ? COLUMN_INDICES.splColumns.reduce((sum, col) => sum + parsePercentage(netRetentionRow[col]), 0) / COLUMN_INDICES.splColumns.length
        : 0,
      
      // New Business Retention: 0-2 Years, Column 11 (Total P&C)
      newBusinessRetention: zeroToTwoYearsRow 
        ? parsePercentage(zeroToTwoYearsRow[COLUMN_INDICES.totalPC]) 
        : 0,
    };
    
    console.log('Extracted Business Metrics:', result);
    
    // Validate we got the key fields
    if (result.estimatedYearEndPremium === 0 && 
        result.autoItemsInForce === 0 && 
        result.homeItemsInForce === 0) {
      console.error('Failed to extract key metrics - no data found in expected locations');
      return null;
    }
    
    return result;
    
  } catch (error) {
    console.error('Error parsing XLSX:', error);
    throw error;
  }
}

// PDF parsing removed - only XLSX is supported for Business Metrics

export async function parseBusinessMetrics(file: File): Promise<BusinessMetricsExtraction | null> {
  const extension = file.name.toLowerCase().split('.').pop();
  
  if (extension === 'xlsx' || extension === 'xls') {
    return parseBusinessMetricsXLSX(file);
  }
  
  // Only XLSX is supported for Business Metrics
  throw new Error('Only XLSX files are supported. Please export your Business Metrics as XLSX from the Allstate portal.');
}

export function validateBusinessMetricsExtraction(data: BusinessMetricsExtraction): { 
  isValid: boolean; 
  missingFields: string[];
  extractedCount: number;
} {
  const fields = [
    { key: 'estimatedYearEndPremium', label: 'Year End Premium' },
    { key: 'autoItemsInForce', label: 'Auto Items' },
    { key: 'autoPremiumWritten', label: 'Auto Premium' },
    { key: 'autoRetention', label: 'Auto Retention' },
    { key: 'homeItemsInForce', label: 'Home Items' },
    { key: 'homePremiumWritten', label: 'Home Premium' },
    { key: 'homeRetention', label: 'Home Retention' },
    { key: 'splItemsInForce', label: 'SPL Items' },
    { key: 'splPremiumWritten', label: 'SPL Premium' },
    { key: 'splRetention', label: 'SPL Retention' },
    { key: 'newBusinessRetention', label: 'New Business Retention' },
  ] as const;
  
  const missingFields: string[] = [];
  let extractedCount = 0;
  
  for (const field of fields) {
    const value = data[field.key];
    if (value > 0) {
      extractedCount++;
    } else {
      missingFields.push(field.label);
    }
  }
  
  return {
    isValid: extractedCount >= 6, // At least half populated
    missingFields,
    extractedCount,
  };
}
