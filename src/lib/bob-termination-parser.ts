/**
 * Parser for Allstate "BOB Termination Audit Report" Excel file
 *
 * This report contains policy terminations used for chargeback calculations.
 *
 * FILE LAYOUT:
 * - Rows 1-5: Metadata (Report title, Download Date, Date Range, Agent info)
 * - Row 6: Column Headers
 * - Row 7+: Data rows
 * - Sheet name: "BOB Termination Audit Report"
 */

import * as XLSX from 'xlsx';

export interface TerminationRecord {
  agentNumber: string;
  insuredFirstName: string;
  insuredLastName: string;
  insuredName: string; // Combined first + last
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  phoneNumber: string | null;
  email: string | null;
  policyNumber: string;
  renewalEffectiveDate: string | null; // MM/DD/YYYY or null for Non-Payment/Void
  lineCode: string;
  originalYear: number;
  anniversaryEffectiveDate: string; // MM/DD/YYYY
  terminationEffectiveDate: string; // MM/DD/YYYY
  terminationReason: string;
  accountType: string;
  premiumNew: number; // Current premium - this is the chargeback amount
  premiumOld: number | null;
  numberOfItems: number;
  // Calculated fields
  isAutoProduct: boolean;
  chargebackWindowDays: number; // 180 for auto, 365 for property
  originalEffectiveDate: string | null; // Calculated from anniversary date and original year
  daysInForce: number | null; // Days from original effective to termination
  rowNumber: number;
}

export interface TerminationParseResult {
  success: boolean;
  records: TerminationRecord[];
  errors: string[];
  dateRange: { start: string; end: string } | null;
  summary: {
    totalRecords: number;
    totalPremium: number;
    autoTerminations: number;
    propertyTerminations: number;
  };
}

/**
 * Parse date from Excel - handles serial dates and MM/DD/YYYY strings
 */
function parseDate(value: any): string | null {
  if (!value) return null;

  // Handle Excel serial dates
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      return `${String(date.m).padStart(2, '0')}/${String(date.d).padStart(2, '0')}/${date.y}`;
    }
  }

  // Handle string dates like "MM/DD/YYYY"
  const strValue = String(value).trim();
  const match = strValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const [, month, day, year] = match;
    return `${month.padStart(2, '0')}/${day.padStart(2, '0')}/${year}`;
  }

  // Try ISO format and convert
  if (/^\d{4}-\d{2}-\d{2}/.test(strValue)) {
    const [year, month, day] = strValue.substring(0, 10).split('-');
    return `${month}/${day}/${year}`;
  }

  return null;
}

/**
 * Parse currency to number: "$1,234.56" or "1234.56" -> 1234.56
 */
function parseCurrency(value: any): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return value;
  const numStr = String(value).replace(/[$,]/g, '');
  const num = parseFloat(numStr);
  return isNaN(num) ? 0 : num;
}

/**
 * Determine if the line code represents an auto product
 */
export function isAutoProduct(lineCode: string): boolean {
  if (!lineCode) return false;
  return lineCode.toLowerCase().includes('auto');
}

/**
 * Get the chargeback window in days based on product type
 * AUTO: 6 months (180 days)
 * PROPERTY: 12 months (365 days)
 */
export function getChargebackWindowDays(lineCode: string): number {
  return isAutoProduct(lineCode) ? 180 : 365;
}

/**
 * Calculate original effective date from anniversary date and original year
 */
function calculateOriginalEffectiveDate(
  anniversaryDateStr: string,
  originalYear: number
): string | null {
  if (!anniversaryDateStr || !originalYear) return null;

  try {
    // Parse anniversary date (MM/DD/YYYY)
    const [month, day] = anniversaryDateStr.split('/');
    if (!month || !day) return null;

    // Original effective date uses the original year with the same month/day as anniversary
    return `${month.padStart(2, '0')}/${day.padStart(2, '0')}/${originalYear}`;
  } catch {
    return null;
  }
}

/**
 * Calculate days in force from original effective date to termination date
 */
function calculateDaysInForce(
  originalEffectiveDateStr: string | null,
  terminationDateStr: string
): number | null {
  if (!originalEffectiveDateStr || !terminationDateStr) return null;

  try {
    // Parse dates (MM/DD/YYYY format)
    const [origMonth, origDay, origYear] = originalEffectiveDateStr.split('/').map(Number);
    const [termMonth, termDay, termYear] = terminationDateStr.split('/').map(Number);

    const origDate = new Date(origYear, origMonth - 1, origDay);
    const termDate = new Date(termYear, termMonth - 1, termDay);

    const diffMs = termDate.getTime() - origDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    return diffDays;
  } catch {
    return null;
  }
}

/**
 * Parse BOB Termination Audit Report Excel file
 */
export function parseBOBTerminationReport(file: ArrayBuffer): TerminationParseResult {
  const errors: string[] = [];
  const records: TerminationRecord[] = [];
  let minDate: string | null = null;
  let maxDate: string | null = null;

  try {
    const workbook = XLSX.read(file, { type: 'array' });

    // Find the target sheet
    let sheetName = workbook.SheetNames.find(
      name => name.toLowerCase().includes('termination') || name.toLowerCase().includes('bob')
    );

    if (!sheetName) {
      sheetName = workbook.SheetNames[0];
    }

    console.log('[BOB Termination Parser] Using sheet:', sheetName);

    const sheet = workbook.Sheets[sheetName];

    // Convert to JSON array - header is at row 6 (index 5)
    const rawData = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: null
    }) as any[][];

    // Find header row - look for rows containing expected column names
    let headerRowIndex = -1;
    const headerPatterns = ['agent number', 'policy number', 'termination', 'premium', 'line code'];

    for (let i = 0; i < Math.min(10, rawData.length); i++) {
      const row = rawData[i];
      if (row) {
        const rowStr = row.map(cell => String(cell || '').toLowerCase()).join('|');
        const matchCount = headerPatterns.filter(p => rowStr.includes(p)).length;
        if (matchCount >= 3) {
          headerRowIndex = i;
          break;
        }
      }
    }

    if (headerRowIndex === -1) {
      return {
        success: false,
        records: [],
        errors: ['Could not find header row. Expected columns like "Agent Number", "Policy Number", "Termination Effective Date", etc.'],
        dateRange: null,
        summary: { totalRecords: 0, totalPremium: 0, autoTerminations: 0, propertyTerminations: 0 }
      };
    }

    const headers = rawData[headerRowIndex].map(h => String(h || '').trim().toLowerCase());
    const dataRows = rawData.slice(headerRowIndex + 1);

    console.log('[BOB Termination Parser] Header row at index:', headerRowIndex);
    console.log('[BOB Termination Parser] Headers:', headers);
    console.log('[BOB Termination Parser] Data rows:', dataRows.length);

    // Build column index map
    const findColumn = (patterns: string[]): number => {
      for (let i = 0; i < headers.length; i++) {
        const lower = headers[i];
        for (const pattern of patterns) {
          if (lower.includes(pattern)) {
            return i;
          }
        }
      }
      return -1;
    };

    const colIndex = {
      agentNumber: findColumn(['agent number']),
      insuredFirstName: findColumn(['insured first', 'first name']),
      insuredLastName: findColumn(['insured last', 'last name']),
      streetAddress: findColumn(['street address', 'address']),
      city: findColumn(['city']),
      state: findColumn(['state']),
      zipCode: findColumn(['zip']),
      phoneNumber: findColumn(['phone']),
      email: findColumn(['email']),
      policyNumber: findColumn(['policy number', 'policy no']),
      renewalEffectiveDate: findColumn(['renewal effective']),
      lineCode: findColumn(['line code']),
      originalYear: findColumn(['original year']),
      anniversaryEffectiveDate: findColumn(['anniversary effective']),
      terminationEffectiveDate: findColumn(['termination effective']),
      terminationReason: findColumn(['termination reason']),
      accountType: findColumn(['account type']),
      premiumNew: findColumn(['premium new']),
      premiumOld: findColumn(['premium old']),
      numberOfItems: findColumn(['number of items', 'items']),
    };

    console.log('[BOB Termination Parser] Column indices:', colIndex);

    // Validate required columns
    const requiredCols = ['policyNumber', 'terminationEffectiveDate', 'premiumNew', 'lineCode'];
    const missingCols = requiredCols.filter(col => colIndex[col as keyof typeof colIndex] === -1);

    if (missingCols.length > 0) {
      return {
        success: false,
        records: [],
        errors: [`Missing required columns: ${missingCols.join(', ')}`],
        dateRange: null,
        summary: { totalRecords: 0, totalPremium: 0, autoTerminations: 0, propertyTerminations: 0 }
      };
    }

    // Process each data row
    let autoCount = 0;
    let propertyCount = 0;

    for (let rowIdx = 0; rowIdx < dataRows.length; rowIdx++) {
      const row = dataRows[rowIdx];
      const absoluteRowNum = rowIdx + headerRowIndex + 2; // Excel row number (1-indexed)

      if (!row || row.every(cell => cell === null || cell === '')) continue;

      const getValue = (idx: number) => idx >= 0 && idx < row.length ? row[idx] : null;

      // Parse policy number
      const policyNumber = String(getValue(colIndex.policyNumber) || '').trim();
      if (!policyNumber) {
        errors.push(`Row ${absoluteRowNum}: Missing Policy Number, skipped`);
        continue;
      }

      // Parse termination date
      const terminationEffectiveDate = parseDate(getValue(colIndex.terminationEffectiveDate));
      if (!terminationEffectiveDate) {
        errors.push(`Row ${absoluteRowNum}: Invalid Termination Effective Date, skipped`);
        continue;
      }

      // Parse other fields
      const lineCode = String(getValue(colIndex.lineCode) || '').trim();
      const originalYear = parseInt(String(getValue(colIndex.originalYear) || '0')) || 0;
      const anniversaryEffectiveDate = parseDate(getValue(colIndex.anniversaryEffectiveDate)) || '';
      const premiumNew = parseCurrency(getValue(colIndex.premiumNew));

      // Calculate derived fields
      const isAuto = isAutoProduct(lineCode);
      const chargebackWindowDays = getChargebackWindowDays(lineCode);
      const originalEffectiveDate = calculateOriginalEffectiveDate(anniversaryEffectiveDate, originalYear);
      const daysInForce = calculateDaysInForce(originalEffectiveDate, terminationEffectiveDate);

      // Track product type counts
      if (isAuto) {
        autoCount++;
      } else {
        propertyCount++;
      }

      // Track date range
      if (!minDate || terminationEffectiveDate < minDate) minDate = terminationEffectiveDate;
      if (!maxDate || terminationEffectiveDate > maxDate) maxDate = terminationEffectiveDate;

      const firstName = String(getValue(colIndex.insuredFirstName) || '').trim();
      const lastName = String(getValue(colIndex.insuredLastName) || '').trim();

      const record: TerminationRecord = {
        agentNumber: String(getValue(colIndex.agentNumber) || '').trim(),
        insuredFirstName: firstName,
        insuredLastName: lastName,
        insuredName: `${firstName} ${lastName}`.trim(),
        streetAddress: String(getValue(colIndex.streetAddress) || '').trim(),
        city: String(getValue(colIndex.city) || '').trim(),
        state: String(getValue(colIndex.state) || '').trim(),
        zipCode: String(getValue(colIndex.zipCode) || '').trim(),
        phoneNumber: getValue(colIndex.phoneNumber) ? String(getValue(colIndex.phoneNumber)).trim() : null,
        email: getValue(colIndex.email) ? String(getValue(colIndex.email)).trim() : null,
        policyNumber,
        renewalEffectiveDate: parseDate(getValue(colIndex.renewalEffectiveDate)),
        lineCode,
        originalYear,
        anniversaryEffectiveDate,
        terminationEffectiveDate,
        terminationReason: String(getValue(colIndex.terminationReason) || '').trim(),
        accountType: String(getValue(colIndex.accountType) || '').trim(),
        premiumNew,
        premiumOld: getValue(colIndex.premiumOld) !== null ? parseCurrency(getValue(colIndex.premiumOld)) : null,
        numberOfItems: parseInt(String(getValue(colIndex.numberOfItems) || '1')) || 1,
        // Calculated fields
        isAutoProduct: isAuto,
        chargebackWindowDays,
        originalEffectiveDate,
        daysInForce,
        rowNumber: absoluteRowNum,
      };

      records.push(record);
    }

    if (records.length === 0) {
      return {
        success: false,
        records: [],
        errors: ['No valid termination records found in the file'],
        dateRange: null,
        summary: { totalRecords: 0, totalPremium: 0, autoTerminations: 0, propertyTerminations: 0 }
      };
    }

    const totalPremium = records.reduce((sum, r) => sum + r.premiumNew, 0);

    const summary = {
      totalRecords: records.length,
      totalPremium,
      autoTerminations: autoCount,
      propertyTerminations: propertyCount,
    };

    console.log('[BOB Termination Parser] Success:', summary);

    return {
      success: true,
      records,
      errors,
      dateRange: minDate && maxDate ? { start: minDate, end: maxDate } : null,
      summary,
    };
  } catch (err) {
    return {
      success: false,
      records: [],
      errors: [`Failed to parse Excel file: ${err instanceof Error ? err.message : 'Unknown error'}`],
      dateRange: null,
      summary: { totalRecords: 0, totalPremium: 0, autoTerminations: 0, propertyTerminations: 0 }
    };
  }
}

/**
 * Calculate chargebacks for a set of terminations based on the chargeback rule
 */
export type ChargebackRule = 'full' | 'three_month' | 'none';

export interface ChargebackCalculationResult {
  totalChargebackPremium: number;
  chargebackCount: number;
  excludedCount: number;
  chargebackTransactions: TerminationRecord[];
  excludedTransactions: TerminationRecord[];
}

export function calculateChargebacks(
  terminations: TerminationRecord[],
  chargebackRule: ChargebackRule
): ChargebackCalculationResult {
  if (chargebackRule === 'none') {
    return {
      totalChargebackPremium: 0,
      chargebackCount: 0,
      excludedCount: terminations.length,
      chargebackTransactions: [],
      excludedTransactions: terminations,
    };
  }

  const chargebackTransactions: TerminationRecord[] = [];
  const excludedTransactions: TerminationRecord[] = [];

  for (const term of terminations) {
    const daysInForce = term.daysInForce;

    // If we can't calculate days in force, include it conservatively
    if (daysInForce === null) {
      chargebackTransactions.push(term);
      continue;
    }

    // Check if within the product's chargeback window
    if (daysInForce >= term.chargebackWindowDays) {
      // Policy was in force long enough - not a chargeback
      excludedTransactions.push(term);
      continue;
    }

    // Apply 3-month rule if active
    if (chargebackRule === 'three_month' && daysInForce >= 90) {
      // Policy was in force > 90 days - excluded under 3-month rule
      excludedTransactions.push(term);
      continue;
    }

    // This is a valid chargeback
    chargebackTransactions.push(term);
  }

  const totalChargebackPremium = chargebackTransactions.reduce((sum, t) => sum + t.premiumNew, 0);

  return {
    totalChargebackPremium,
    chargebackCount: chargebackTransactions.length,
    excludedCount: excludedTransactions.length,
    chargebackTransactions,
    excludedTransactions,
  };
}

/**
 * Match terminations to producers by policy number
 * Returns a map of sub-producer code -> termination records
 */
export function matchTerminationsToProducers(
  terminations: TerminationRecord[],
  policyToProducerMap: Map<string, string> // policy number -> sub-producer code
): Map<string, TerminationRecord[]> {
  const result = new Map<string, TerminationRecord[]>();

  for (const term of terminations) {
    const producerCode = policyToProducerMap.get(term.policyNumber);

    if (!producerCode) {
      // No matching producer found - could add to "UNASSIGNED"
      const unassigned = result.get('UNASSIGNED') || [];
      unassigned.push(term);
      result.set('UNASSIGNED', unassigned);
      continue;
    }

    const producerTerms = result.get(producerCode) || [];
    producerTerms.push(term);
    result.set(producerCode, producerTerms);
  }

  return result;
}
