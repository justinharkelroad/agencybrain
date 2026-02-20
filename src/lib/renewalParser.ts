import * as XLSX from 'xlsx';
import type { ParsedRenewalRecord, BundledStatus } from '@/types/renewal';

// Exact column names from Allstate BOB Renewal Audit Report
const COLUMN_MAP: Record<string, keyof ParsedRenewalRecord> = {
  // Customer info
  'Insured First Name': 'firstName',
  'Insured Last Name': 'lastName',
  'Insured Email': 'email',
  'Insured Phone': 'phone',

  // Policy info
  'Policy Number': 'policyNumber',
  'Agent#': 'agentNumber',
  'Product Code': 'productCode',
  'Product Name': 'productName',
  'Original Year': 'originalYear',
  'Account Type': 'accountType',
  'Renewal Status': 'renewalStatus',
  'Renewal Effective Date': 'renewalEffectiveDate',

  // Premium fields - note the ($) and (%) suffixes
  'Premium Old($)': 'premiumOld',
  'Premium New($)': 'premiumNew',
  'Premium Change($)': 'premiumChangeDollars',
  'Premium Change(%)': 'premiumChangePercent',
  'Amount Due($)': 'amountDue',

  // Policy attributes
  'Easy Pay': 'easyPay',
  'Multi-line Indicator': 'multiLineIndicator',
  'Item Count': 'itemCount',
  'Years Prior Insurance': 'yearsPriorInsurance',

  // Additional Allstate columns
  'Status': 'carrierStatus',
  'Zip Code': 'zipCode',
  'City': 'city',
  'State': 'state',

  // Fallback mappings for other report formats
  'First Name': 'firstName',
  'Last Name': 'lastName',
  'Email': 'email',
  'Phone': 'phone',
  'Agent Number': 'agentNumber',
  'Premium Old': 'premiumOld',
  'Premium New': 'premiumNew',
  'Premium Change': 'premiumChangeDollars',
  'Change %': 'premiumChangePercent',
  'Amount Due': 'amountDue',
  'Multiline': 'multiLineIndicator',
  'Bundled': 'multiLineIndicator',
  '# Items': 'itemCount',
  'No of Items': 'itemCount',
  'Household Key': 'householdKey',
  'HH Key': 'householdKey',
};

function parseDate(value: any): string | null {
  if (!value) return null;
  
  // Handle Excel serial date numbers
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
    }
  }
  
  // Handle string dates
  if (typeof value === 'string') {
    // MM/DD/YYYY format
    const slashParts = value.split('/');
    if (slashParts.length === 3) {
      const [m, d, y] = slashParts;
      const fullYear = y.length === 2 ? '20' + y : y;
      return `${fullYear}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    // Already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }
  }
  
  return null;
}

function parseNumber(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    // Remove currency symbols, commas, percent signs, parentheses
    const cleaned = value.replace(/[$,%\s()]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }
  return null;
}

function parseBoolean(value: any): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const lower = value.toLowerCase().trim();
    return lower === 'yes' || lower === 'y' || lower === 'true' || lower === '1' || lower === 'x';
  }
  return value === 1;
}

function parseBundledStatus(value: any): BundledStatus {
  // Return 'n/a' for empty/null/undefined values
  if (value === null || value === undefined || value === '') return 'n/a';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (typeof value === 'string') {
    const lower = value.toLowerCase().trim();
    if (lower === '') return 'n/a';
    if (lower === 'yes' || lower === 'y' || lower === 'true' || lower === '1' || lower === 'x') return 'yes';
    if (lower === 'no' || lower === 'n' || lower === 'false' || lower === '0') return 'no';
  }
  if (value === 1) return 'yes';
  if (value === 0) return 'no';
  return 'n/a'; // Unknown values default to n/a
}

function parseYear(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Math.round(value);
  if (typeof value === 'string') {
    const num = parseInt(value.trim(), 10);
    return isNaN(num) ? null : num;
  }
  return null;
}

function findHeaderRow(data: any[][]): number {
  // Look for a row that contains 'Policy Number' - that's our header row
  for (let i = 0; i < Math.min(data.length, 20); i++) {
    const row = data[i];
    if (row && row.some(cell => cell && String(cell).trim() === 'Policy Number')) {
      return i;
    }
  }
  return -1;
}

export function parseRenewalExcel(workbook: XLSX.WorkBook): ParsedRenewalRecord[] {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  
  // Get raw data as 2D array to find header row
  const rawArray = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: null });
  
  if (rawArray.length === 0) {
    throw new Error('No data found in spreadsheet');
  }
  
  // Find the header row (contains 'Policy Number')
  const headerRowIndex = findHeaderRow(rawArray);
  if (headerRowIndex === -1) {
    throw new Error('Policy Number column not found. Please ensure this is an Allstate BOB Renewal Audit report.');
  }
  
  const headers = rawArray[headerRowIndex].map((h: any) => h ? String(h).trim() : '');
  
  // Build column index map
  const columnIndex: Record<number, string> = {};
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    if (header && COLUMN_MAP[header]) {
      columnIndex[i] = COLUMN_MAP[header];
    }
  }
  
  // Verify we have Policy Number
  if (!Object.values(columnIndex).includes('policyNumber')) {
    throw new Error('Policy Number column not found in headers');
  }
  
  // Verify we have Renewal Effective Date
  if (!Object.values(columnIndex).includes('renewalEffectiveDate')) {
    throw new Error('Renewal Effective Date column not found in headers');
  }
  
  const records: ParsedRenewalRecord[] = [];
  
  // Process data rows (after header)
  for (let rowIdx = headerRowIndex + 1; rowIdx < rawArray.length; rowIdx++) {
    const row = rawArray[rowIdx];
    if (!row || row.every((cell: any) => cell === null || cell === '')) continue;
    
    const record: Partial<ParsedRenewalRecord> = {};
    
    for (const [colIdxStr, fieldName] of Object.entries(columnIndex)) {
      const colIdx = parseInt(colIdxStr);
      const value = row[colIdx];
      
      switch (fieldName) {
        case 'policyNumber':
        case 'firstName':
        case 'lastName':
        case 'email':
        case 'phone':
        case 'phoneAlt':
        case 'productName':
        case 'productCode':
        case 'agentNumber':
        case 'renewalStatus':
        case 'accountType':
        case 'householdKey':
        case 'carrierStatus':
        case 'zipCode':
        case 'city':
        case 'state':
          record[fieldName] = value ? String(value).trim() : null;
          break;
        case 'originalYear':
          record[fieldName] = parseYear(value);
          break;
        case 'renewalEffectiveDate':
          record[fieldName] = parseDate(value) || '';
          break;
        case 'premiumOld':
        case 'premiumNew':
        case 'premiumChangeDollars':
        case 'premiumChangePercent':
        case 'amountDue':
          record[fieldName] = parseNumber(value);
          break;
        case 'itemCount':
        case 'yearsPriorInsurance': {
          const num = parseNumber(value);
          record[fieldName] = num !== null ? Math.round(num) : null;
          break;
        }
        case 'easyPay':
          record[fieldName] = parseBoolean(value);
          break;
        case 'multiLineIndicator':
          record[fieldName] = parseBundledStatus(value);
          break;
      }
    }
    
    // Only include records with valid policy number and effective date
    if (record.policyNumber && record.renewalEffectiveDate) {
      // Calculate premium change if missing but we have old/new
      if (record.premiumOld != null && record.premiumNew != null) {
        if (record.premiumChangeDollars == null) {
          record.premiumChangeDollars = record.premiumNew - record.premiumOld;
        }
        if (record.premiumChangePercent == null && record.premiumOld !== 0) {
          record.premiumChangePercent = ((record.premiumNew - record.premiumOld) / record.premiumOld) * 100;
        }
      }

      // Set defaults for required boolean/enum fields if columns weren't present
      if (record.multiLineIndicator === undefined) {
        record.multiLineIndicator = 'n/a';
      }
      if (record.easyPay === undefined) {
        record.easyPay = false;
      }

      records.push(record as ParsedRenewalRecord);
    }
  }
  
  if (records.length === 0) {
    throw new Error('No valid records found. Each record needs a Policy Number and Renewal Effective Date.');
  }
  
  return records;
}

export function getRenewalDateRange(records: ParsedRenewalRecord[]): { start: string; end: string } | null {
  const dates = records
    .map(r => r.renewalEffectiveDate)
    .filter(d => d && d.length > 0)
    .sort();

  if (dates.length === 0) return null;

  return {
    start: dates[0],
    end: dates[dates.length - 1],
  };
}

/**
 * Determines if a renewal is a first-term renewal based on product code and original year.
 *
 * This matches the manual process from the Allstate BOB report where users filter
 * "Original Year = last year" to find first-term renewals.
 *
 * Limitation: Without the original MONTH (only year is available), we cannot
 * perfectly distinguish first vs second renewals for 6-month auto policies.
 * This logic errs on the side of inclusion - some displayed records may be
 * second renewals for auto policies written early in the previous year.
 *
 * - Auto (Product Code "010"): 6-month terms
 * - Other products: 12-month terms
 */
export function isFirstTermRenewal(
  productCode: string | null,
  originalYear: number | null,
  renewalEffectiveDate: string
): boolean {
  if (originalYear === null) return false;

  // Get the year from the renewal effective date
  const renewalYear = renewalEffectiveDate ? parseInt(renewalEffectiveDate.substring(0, 4), 10) : new Date().getFullYear();
  if (isNaN(renewalYear)) return false;

  // Match the manual process: original year = last year (renewal year - 1)
  // This works for both 6-month auto and 12-month other products as a reasonable heuristic
  return originalYear === renewalYear - 1;
}
