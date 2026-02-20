import * as XLSX from 'xlsx';

export interface ParsedCancelAuditRecord {
  policy_number: string;
  household_key: string;
  insured_first_name: string | null;
  insured_last_name: string | null;
  insured_email: string | null;
  insured_phone: string | null;
  insured_phone_alt: string | null;
  agent_number: string | null;
  product_name: string | null;
  premium_cents: number;
  no_of_items: number;
  account_type: string | null;
  report_type: 'cancellation' | 'pending_cancel';
  amount_due_cents: number | null;
  cancel_date: string | null;
  renewal_effective_date: string | null;
  pending_cancel_date: string | null;
  cancel_status: string | null;
  original_year: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  company_code: string | null;
  premium_old_cents: number;
}

export interface ParseResult {
  success: boolean;
  records: ParsedCancelAuditRecord[];
  errors: string[];
  duplicatesRemoved: number;
}

// Generate household key: "LASTNAME_FIRSTNAME" normalized
function generateHouseholdKey(firstName: string | null, lastName: string | null): string {
  const normalizedLast = (lastName || 'UNKNOWN').toUpperCase().trim().replace(/[^A-Z]/g, '');
  const normalizedFirst = (firstName || 'UNKNOWN').toUpperCase().trim().replace(/[^A-Z]/g, '');
  return `${normalizedLast}_${normalizedFirst}`;
}

// Parse currency string to cents: "$1,234.56" -> 123456
function parseCurrencyToCents(value: any): number {
  if (value === null || value === undefined || value === '') return 0;
  const numStr = String(value).replace(/[$,]/g, '');
  const num = parseFloat(numStr);
  return isNaN(num) ? 0 : Math.round(num * 100);
}

// Parse date from various formats to YYYY-MM-DD
function parseDate(value: any): string | null {
  if (!value) return null;
  
  // Handle Excel serial dates
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
    }
  }
  
  // Handle string dates like "MM/DD/YYYY" or "12/27/2025"
  const strValue = String(value).trim();
  const match = strValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const [, month, day, year] = match;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // Try ISO format
  if (/^\d{4}-\d{2}-\d{2}/.test(strValue)) {
    return strValue.substring(0, 10);
  }
  
  return null;
}

// Map account type
function mapAccountType(value: any): string | null {
  if (!value) return null;
  const str = String(value).toLowerCase();
  if (str.includes('agent')) return 'Agency';
  if (str.includes('requested')) return 'Requested';
  return String(value);
}

// Clean phone number
function cleanPhone(value: any): string | null {
  if (!value) return null;
  const cleaned = String(value).replace(/[^0-9-]/g, '').trim();
  return cleaned || null;
}

export function parseCancelAuditExcel(
  file: ArrayBuffer,
  reportType: 'cancellation' | 'pending_cancel'
): ParseResult {
  const errors: string[] = [];
  const records: ParsedCancelAuditRecord[] = [];
  const seenPolicies = new Set<string>();
  let duplicatesRemoved = 0;

  try {
    const workbook = XLSX.read(file, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // Convert to JSON array of arrays
    const rawData = XLSX.utils.sheet_to_json(sheet, { 
      header: 1,
      defval: null 
    }) as any[][];

    // Find header row (should be around row index 4, but search to be safe)
    let headerRowIndex = -1;
    for (let i = 0; i < Math.min(10, rawData.length); i++) {
      const row = rawData[i];
      if (row && row.some(cell => String(cell).includes('Policy Number'))) {
        headerRowIndex = i;
        break;
      }
    }

    if (headerRowIndex === -1) {
      return { 
        success: false, 
        records: [], 
        errors: ['Could not find header row with "Policy Number" column'], 
        duplicatesRemoved: 0 
      };
    }

    const headers = rawData[headerRowIndex].map(h => String(h || '').trim());
    const dataRows = rawData.slice(headerRowIndex + 1);

    // Find column indexes
    const colIndex: Record<string, number> = {};
    headers.forEach((header, idx) => {
      colIndex[header] = idx;
    });

    // Validate required columns exist
    if (colIndex['Policy Number'] === undefined) {
      return { 
        success: false, 
        records: [], 
        errors: ['Missing required column: Policy Number'], 
        duplicatesRemoved: 0 
      };
    }

    // Process each row
    for (let rowIdx = 0; rowIdx < dataRows.length; rowIdx++) {
      const row = dataRows[rowIdx];
      if (!row || row.every(cell => cell === null || cell === '')) continue;

      const getValue = (colName: string) => {
        const idx = colIndex[colName];
        return idx !== undefined ? row[idx] : null;
      };

      const policyNumber = String(getValue('Policy Number') || '').trim();
      if (!policyNumber) {
        errors.push(`Row ${rowIdx + headerRowIndex + 2}: Missing policy number, skipped`);
        continue;
      }

      // Deduplicate within same file
      if (seenPolicies.has(policyNumber)) {
        duplicatesRemoved++;
        continue;
      }
      seenPolicies.add(policyNumber);

      const firstName = getValue('Insured First Name') ? String(getValue('Insured First Name')).trim() : null;
      const lastName = getValue('Insured Last Name') ? String(getValue('Insured Last Name')).trim() : null;

      // Note: "Insured Preferred  Phone" has double space in original Allstate report
      // Read the Status column from Excel. We preserve whatever status text is provided
      // (e.g. Cancel, Cancelled, S-cancel) so reporting can sort by the exact report value.
      const excelStatus = getValue('Status') ? String(getValue('Status')).trim() : null;
      const statusKey = excelStatus?.toLowerCase();
      
      // Derive report_type from Excel Status column if present
      // "Cancel" = pending cancellation (savable), "Cancelled" = already cancelled
      const derivedReportType: 'cancellation' | 'pending_cancel' = 
        statusKey === 'cancel'
          ? 'pending_cancel'
          : statusKey === 'cancelled'
            ? 'cancellation'
            : reportType; // fallback to parameter if Status column missing/unrecognized

      const record: ParsedCancelAuditRecord = {
        policy_number: policyNumber,
        household_key: generateHouseholdKey(firstName, lastName),
        insured_first_name: firstName,
        insured_last_name: lastName,
        insured_email: getValue('Insured Email') ? String(getValue('Insured Email')).trim().toLowerCase() : null,
        insured_phone: cleanPhone(getValue('Insured Phone')),
        insured_phone_alt: derivedReportType === 'cancellation' ? cleanPhone(getValue('Insured Preferred  Phone')) : null,
        agent_number: getValue('Agent#') ? String(getValue('Agent#')).trim() : null,
        product_name: getValue('Product Name') ? String(getValue('Product Name')).trim() : null,
        premium_cents: parseCurrencyToCents(getValue('Premium New($)')),
        no_of_items: parseInt(String(getValue('No. of Items') || '1')) || 1,
        account_type: mapAccountType(getValue('Account Type')),
        report_type: derivedReportType,
        amount_due_cents: derivedReportType === 'cancellation' ? parseCurrencyToCents(getValue('Amount Due($)')) : null,
        cancel_date: derivedReportType === 'cancellation' ? parseDate(getValue('Cancel Date')) : null,
        renewal_effective_date: derivedReportType === 'pending_cancel' ? parseDate(getValue('Renewal Effective Date')) : null,
        pending_cancel_date: derivedReportType === 'pending_cancel' ? parseDate(getValue('Pending Cancel Date')) : null,
        cancel_status: excelStatus,
        original_year: getValue('Original Year') ? String(getValue('Original Year')).trim() : null,
        city: getValue('City') ? String(getValue('City')).trim() : null,
        state: getValue('State') ? String(getValue('State')).trim() : null,
        zip_code: getValue('Zip Code') ? String(getValue('Zip Code')).trim() : null,
        company_code: getValue('Company Code') ? String(getValue('Company Code')).trim() : null,
        premium_old_cents: parseCurrencyToCents(getValue('Premium Old($)')),
      };

      records.push(record);
    }

    return { success: true, records, errors, duplicatesRemoved };
  } catch (err) {
    return { 
      success: false, 
      records: [], 
      errors: [`Failed to parse Excel file: ${err instanceof Error ? err.message : 'Unknown error'}`],
      duplicatesRemoved: 0 
    };
  }
}
