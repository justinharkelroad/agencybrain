import * as XLSX from 'xlsx';

// Types
export interface ParsedWinbackRecord {
  firstName: string;
  lastName: string;
  zipCode: string;
  email: string | null;
  phone: string | null;
  agentNumber: string | null;
  policyNumber: string;
  originalYear: number | null;
  productCode: string | null;
  productName: string;
  renewalEffectiveDate: Date | null;
  anniversaryEffectiveDate: Date | null;
  terminationEffectiveDate: Date;
  terminationReason: string | null;
  terminationType: string | null;
  premiumNewCents: number | null;
  premiumOldCents: number | null;
  accountType: string | null;
  companyCode: string | null;
  // Extended termination report fields
  itemsCount: number;
  lineCode: string | null;
  // Calculated fields
  policyTermMonths: number;
  isCancelRewrite: boolean;
}

export interface ParseResult {
  records: ParsedWinbackRecord[];
  errors: string[];
  skipped: number;
}

// Column mapping - maps various header names to our standardized field names
const COLUMN_MAP: Record<string, keyof ParsedWinbackRecord> = {
  // Allstate standard headers
  'Insured First Name': 'firstName',
  'Insured Last Name': 'lastName',
  'Zip Code': 'zipCode',
  'Insured Email': 'email',
  'Insured Phone': 'phone',
  'Agent#': 'agentNumber',
  'Policy Number': 'policyNumber',
  'Original Year': 'originalYear',
  'Product Code': 'productCode',
  'Product Name': 'productName',
  'Renewal Effective Date': 'renewalEffectiveDate',
  'Anniversary Effective Date': 'anniversaryEffectiveDate',
  'Termination Effective Date': 'terminationEffectiveDate',
  'Termination Reason': 'terminationReason',
  'Termination Type': 'terminationType',
  'Premium New($)': 'premiumNewCents',
  'Premium Old($)': 'premiumOldCents',
  'Account Type': 'accountType',
  'Company Code': 'companyCode',

  // Extended termination report columns
  'Number Of Items': 'itemsCount',
  'Line Code': 'lineCode',

  // Alternate headers (some agencies use these)
  'Agent Number': 'agentNumber',
  'Phone Number': 'phone',
  'Email': 'email',
  'First Name': 'firstName',
  'Last Name': 'lastName',
  'Zip': 'zipCode',
  'Phone': 'phone',
  'Pol Nbr': 'policyNumber',
  'Premium New': 'premiumNewCents',
  'Premium Old': 'premiumOldCents',
  'Items': 'itemsCount',
  'Item Count': 'itemsCount',
};

// Determine policy term based on product name
function getPolicyTermMonths(productName: string): number {
  if (!productName) return 12; // Default to 12 if no product name
  
  const lowerName = productName.toLowerCase();
  
  // Auto products = 6 month term
  if (lowerName.includes('auto')) return 6;
  
  // Property products = 12 month term
  if (lowerName.includes('homeowner')) return 12;
  if (lowerName.includes('landlord')) return 12;
  if (lowerName.includes('renter')) return 12;
  if (lowerName.includes('umbrella')) return 12;
  if (lowerName.includes('condo')) return 12;
  if (lowerName.includes('dwelling')) return 12;
  if (lowerName.includes('fire')) return 12;
  
  // Default to 12 for unknown types
  return 12;
}

// Check if termination reason indicates cancel/rewrite
function isCancelRewrite(reason: string | null): boolean {
  if (!reason) return false;
  return reason.toLowerCase().includes('cancel/rewrite');
}

// Parse date from various formats
function parseDate(value: any): Date | null {
  if (!value) return null;
  
  // If it's already a Date
  if (value instanceof Date) return value;
  
  // If it's a number (Excel serial date)
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      return new Date(date.y, date.m - 1, date.d);
    }
  }
  
  // If it's a string, try parsing
  if (typeof value === 'string') {
    // Handle MM/DD/YYYY format
    const parts = value.split('/');
    if (parts.length === 3) {
      const month = parseInt(parts[0], 10) - 1;
      const day = parseInt(parts[1], 10);
      const year = parseInt(parts[2], 10);
      if (!isNaN(month) && !isNaN(day) && !isNaN(year)) {
        return new Date(year, month, day);
      }
    }
    
    // Try standard parsing
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  
  return null;
}

// Parse currency to cents
function parseCurrencyToCents(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  
  // If it's already a number
  if (typeof value === 'number') {
    return Math.round(value * 100);
  }
  
  // If it's a string, clean it up
  if (typeof value === 'string') {
    const cleaned = value.replace(/[$,]/g, '').trim();
    const num = parseFloat(cleaned);
    if (!isNaN(num)) {
      return Math.round(num * 100);
    }
  }
  
  return null;
}

// Clean phone number
function cleanPhone(value: any): string | null {
  if (!value) return null;
  const cleaned = String(value).replace(/[^\d]/g, '');
  if (cleaned.length >= 10) {
    return cleaned.slice(-10); // Take last 10 digits
  }
  return cleaned || null;
}

// Clean and normalize zip code (take first 5 digits)
function cleanZipCode(value: any): string {
  if (!value) return '';
  const str = String(value).trim();
  // Extract first 5 digits
  const match = str.match(/^\d{5}/);
  return match ? match[0] : str.split('-')[0] || str;
}

export function parseWinbackExcel(workbook: XLSX.WorkBook): ParseResult {
  const errors: string[] = [];
  const records: ParsedWinbackRecord[] = [];
  let skipped = 0;

  try {
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawArray = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: null });

    console.log('=== WINBACK PARSER DEBUG ===');
    console.log('Total rows in file:', rawArray.length);
    console.log('First 6 rows:');
    rawArray.slice(0, 6).forEach((row, i) => {
      console.log(`Row ${i}:`, Array.isArray(row) ? row.slice(0, 5) : row);
    });

    // Find header row - Allstate files have metadata rows before headers
    // Look for row containing "Insured First Name" or "Policy Number"
    let headerRowIndex = -1;
    for (let i = 0; i < Math.min(15, rawArray.length); i++) {
      const row = rawArray[i];
      if (Array.isArray(row)) {
        const rowStr = row.map(cell => String(cell || '')).join('|');
        // Check for Allstate-specific headers
        if (
          rowStr.includes('Insured First Name') ||
          rowStr.includes('Policy Number') ||
          (rowStr.includes('First Name') && rowStr.includes('Last Name') && rowStr.includes('Termination'))
        ) {
          headerRowIndex = i;
          break;
        }
      }
    }

    console.log('Header row found at index:', headerRowIndex);
    if (headerRowIndex >= 0) {
      console.log('Header row content:', rawArray[headerRowIndex]);
    }

    if (headerRowIndex === -1) {
      errors.push('Could not find header row. Expected columns like "Insured First Name", "Policy Number", etc.');
      return { records: [], errors, skipped: 0 };
    }

    // Build column index map
    const headerRow = rawArray[headerRowIndex];
    const columnIndex: Record<string, number> = {};
    
    headerRow.forEach((cell: any, index: number) => {
      if (cell) {
        const headerName = String(cell).trim();
        const mappedField = COLUMN_MAP[headerName];
        if (mappedField) {
          columnIndex[mappedField] = index;
        }
      }
    });

    // Validate required columns
    const requiredFields = ['firstName', 'lastName', 'zipCode', 'policyNumber', 'productName', 'terminationEffectiveDate'];
    const missingFields = requiredFields.filter(f => columnIndex[f] === undefined);
    
    if (missingFields.length > 0) {
      errors.push(`Missing required columns: ${missingFields.join(', ')}`);
      return { records: [], errors, skipped: 0 };
    }

    // Process data rows
    for (let i = headerRowIndex + 1; i < rawArray.length; i++) {
      const row = rawArray[i];
      if (!row || !Array.isArray(row)) continue;

      // Skip empty rows
      const policyNumber = row[columnIndex['policyNumber']];
      if (!policyNumber) {
        skipped++;
        continue;
      }

      try {
        const firstName = String(row[columnIndex['firstName']] || '').trim().toUpperCase();
        const lastName = String(row[columnIndex['lastName']] || '').trim().toUpperCase();
        const zipCode = cleanZipCode(row[columnIndex['zipCode']]);
        const productName = String(row[columnIndex['productName']] || '').trim();
        const terminationDate = parseDate(row[columnIndex['terminationEffectiveDate']]);
        const terminationReason = row[columnIndex['terminationReason']] ? String(row[columnIndex['terminationReason']]).trim() : null;

        // Validate required fields
        if (!firstName || !lastName || !zipCode || !productName || !terminationDate) {
          errors.push(`Row ${i + 1}: Missing required data (name, zip, product, or termination date)`);
          skipped++;
          continue;
        }

        // Parse items count (default to 1 if not present)
        const itemsCountRaw = row[columnIndex['itemsCount']];
        const itemsCount = itemsCountRaw ? parseInt(String(itemsCountRaw), 10) : 1;

        // Parse line code
        const lineCode = row[columnIndex['lineCode']] ? String(row[columnIndex['lineCode']]).trim() : null;

        const record: ParsedWinbackRecord = {
          firstName,
          lastName,
          zipCode,
          email: row[columnIndex['email']] ? String(row[columnIndex['email']]).trim().toLowerCase() : null,
          phone: cleanPhone(row[columnIndex['phone']]),
          agentNumber: row[columnIndex['agentNumber']] ? String(row[columnIndex['agentNumber']]).trim() : null,
          policyNumber: String(policyNumber).trim(),
          originalYear: row[columnIndex['originalYear']] ? parseInt(String(row[columnIndex['originalYear']])) : null,
          productCode: row[columnIndex['productCode']] ? String(row[columnIndex['productCode']]).trim() : null,
          productName,
          renewalEffectiveDate: parseDate(row[columnIndex['renewalEffectiveDate']]),
          anniversaryEffectiveDate: parseDate(row[columnIndex['anniversaryEffectiveDate']]),
          terminationEffectiveDate: terminationDate,
          terminationReason,
          terminationType: row[columnIndex['terminationType']] ? String(row[columnIndex['terminationType']]).trim() : null,
          premiumNewCents: parseCurrencyToCents(row[columnIndex['premiumNewCents']]),
          premiumOldCents: parseCurrencyToCents(row[columnIndex['premiumOldCents']]),
          accountType: row[columnIndex['accountType']] ? String(row[columnIndex['accountType']]).trim() : null,
          companyCode: row[columnIndex['companyCode']] ? String(row[columnIndex['companyCode']]).trim() : null,
          // Extended termination report fields
          itemsCount: isNaN(itemsCount) ? 1 : Math.max(1, itemsCount),
          lineCode,
          // Calculated fields
          policyTermMonths: getPolicyTermMonths(productName),
          isCancelRewrite: isCancelRewrite(terminationReason),
        };

        records.push(record);
      } catch (err) {
        errors.push(`Row ${i + 1}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        skipped++;
      }
    }

    return { records, errors, skipped };
  } catch (err) {
    errors.push(`Failed to parse Excel file: ${err instanceof Error ? err.message : 'Unknown error'}`);
    return { records: [], errors, skipped };
  }
}

// Calculate win-back date based on the NEXT FUTURE competitor renewal
// Keeps adding policy term until we find a renewal date AFTER today
export function calculateWinbackDate(
  terminationDate: Date,
  policyTermMonths: number,
  contactDaysBefore: number
): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Start with first competitor renewal (termination + policy term)
  let competitorRenewalDate = new Date(terminationDate);
  competitorRenewalDate.setMonth(competitorRenewalDate.getMonth() + policyTermMonths);
  
  // Keep adding policy terms until we find a renewal date in the future
  while (competitorRenewalDate <= today) {
    competitorRenewalDate.setMonth(competitorRenewalDate.getMonth() + policyTermMonths);
  }
  
  // Win-back date is X days before that future renewal
  const winbackDate = new Date(competitorRenewalDate);
  winbackDate.setDate(winbackDate.getDate() - contactDaysBefore);
  
  return winbackDate;
}

// Calculate NEXT cycle win-back date (for "Not Now" button)
// Takes current win-back date and pushes forward by one policy term
export function calculateNextCycleWinbackDate(
  currentWinbackDate: Date,
  policyTermMonths: number,
  contactDaysBefore: number
): Date {
  // Add the policy term to get to next competitor renewal
  const nextRenewalDate = new Date(currentWinbackDate);
  nextRenewalDate.setDate(nextRenewalDate.getDate() + contactDaysBefore); // Get back to renewal date
  nextRenewalDate.setMonth(nextRenewalDate.getMonth() + policyTermMonths); // Add term
  
  // Subtract contact days to get new win-back date
  const newWinbackDate = new Date(nextRenewalDate);
  newWinbackDate.setDate(newWinbackDate.getDate() - contactDaysBefore);
  
  return newWinbackDate;
}

// Generate household key for deduplication
export function getHouseholdKey(record: ParsedWinbackRecord): string {
  return `${record.firstName.toLowerCase()}|${record.lastName.toLowerCase()}|${record.zipCode.substring(0, 5)}`;
}
