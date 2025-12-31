import * as XLSX from 'xlsx';
import type { ParsedRenewalRecord, AccountType } from '@/types/renewal';

// Column mapping for Allstate BOB Renewal Audit Excel format
const COLUMN_MAP: Record<string, keyof ParsedRenewalRecord> = {
  'Policy Number': 'policy_number',
  'Household Key': 'household_key',
  'First Name': 'insured_first_name',
  'Last Name': 'insured_last_name',
  'Email': 'insured_email',
  'Phone': 'insured_phone',
  'Alt Phone': 'insured_phone_alt',
  'Agent Number': 'agent_number',
  'Product': 'product_name',
  'Premium': 'premium_cents',
  'No of Items': 'no_of_items',
  'Account Type': 'account_type',
  'Renewal Effective Date': 'renewal_effective_date',
  // Alternative column names
  'Policy': 'policy_number',
  'Household': 'household_key',
  'Insured First Name': 'insured_first_name',
  'Insured Last Name': 'insured_last_name',
  'Insured Email': 'insured_email',
  'Insured Phone': 'insured_phone',
  'Phone Alt': 'insured_phone_alt',
  'Agent': 'agent_number',
  'Product Name': 'product_name',
  'Items': 'no_of_items',
  'Effective Date': 'renewal_effective_date',
  'Renewal Date': 'renewal_effective_date',
};

// Parse Excel serial date to ISO string
function parseDate(value: unknown): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  // Handle Excel serial date numbers
  if (typeof value === 'number') {
    try {
      const parsed = XLSX.SSF.parse_date_code(value);
      if (parsed) {
        const year = parsed.y;
        const month = String(parsed.m).padStart(2, '0');
        const day = String(parsed.d).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    } catch {
      // Fall through to string parsing
    }
  }

  // Handle string dates (MM/DD/YYYY or YYYY-MM-DD)
  if (typeof value === 'string') {
    const trimmed = value.trim();
    
    // Already ISO format
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    
    // MM/DD/YYYY format
    const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (match) {
      const [, month, day, year] = match;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
  }

  return null;
}

// Parse premium to cents
function parsePremium(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'number') {
    return Math.round(value * 100);
  }

  if (typeof value === 'string') {
    // Remove currency symbols and commas
    const cleaned = value.replace(/[$,]/g, '').trim();
    const parsed = parseFloat(cleaned);
    if (!isNaN(parsed)) {
      return Math.round(parsed * 100);
    }
  }

  return null;
}

// Parse account type
function parseAccountType(value: unknown): AccountType | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const str = String(value).toLowerCase().trim();
  if (str === 'personal' || str === 'p') {
    return 'personal';
  }
  if (str === 'commercial' || str === 'c' || str === 'business') {
    return 'commercial';
  }

  return null;
}

// Parse integer value
function parseInt(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'number') {
    return Math.floor(value);
  }

  if (typeof value === 'string') {
    const parsed = Number.parseInt(value.trim(), 10);
    if (!isNaN(parsed)) {
      return parsed;
    }
  }

  return null;
}

// Parse string value
function parseString(value: unknown): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  return String(value).trim();
}

// Main parser function
export function parseRenewalExcel(file: File): Promise<ParsedRenewalRecord[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: null });

        if (rows.length === 0) {
          reject(new Error('No data found in Excel file'));
          return;
        }

        // Map columns from first row headers
        const firstRow = rows[0] as Record<string, unknown>;
        const headers = Object.keys(firstRow);
        const columnMapping: Record<string, keyof ParsedRenewalRecord> = {};

        for (const header of headers) {
          const normalizedHeader = header.trim();
          if (COLUMN_MAP[normalizedHeader]) {
            columnMapping[header] = COLUMN_MAP[normalizedHeader];
          }
        }

        // Validate required columns
        const mappedFields = new Set(Object.values(columnMapping));
        if (!mappedFields.has('policy_number')) {
          reject(new Error('Missing required column: Policy Number'));
          return;
        }

        // Parse all rows
        const records: ParsedRenewalRecord[] = [];

        for (const row of rows) {
          const typedRow = row as Record<string, unknown>;
          
          const record: ParsedRenewalRecord = {
            policy_number: '',
            household_key: '',
            insured_first_name: null,
            insured_last_name: null,
            insured_email: null,
            insured_phone: null,
            insured_phone_alt: null,
            agent_number: null,
            product_name: null,
            premium_cents: null,
            no_of_items: null,
            account_type: null,
            renewal_effective_date: null,
          };

          for (const [originalCol, targetField] of Object.entries(columnMapping)) {
            const value = typedRow[originalCol];

            switch (targetField) {
              case 'policy_number':
              case 'household_key':
              case 'insured_first_name':
              case 'insured_last_name':
              case 'insured_email':
              case 'insured_phone':
              case 'insured_phone_alt':
              case 'agent_number':
              case 'product_name':
                record[targetField] = parseString(value);
                break;
              case 'premium_cents':
                record.premium_cents = parsePremium(value);
                break;
              case 'no_of_items':
                record.no_of_items = parseInt(value);
                break;
              case 'account_type':
                record.account_type = parseAccountType(value);
                break;
              case 'renewal_effective_date':
                record.renewal_effective_date = parseDate(value);
                break;
            }
          }

          // Skip rows without policy number
          if (!record.policy_number) {
            continue;
          }

          // Generate household key if not provided
          if (!record.household_key) {
            record.household_key = record.policy_number;
          }

          records.push(record);
        }

        resolve(records);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsArrayBuffer(file);
  });
}

// Get date range from parsed records
export function getRenewalDateRange(records: ParsedRenewalRecord[]): { min: string | null; max: string | null } {
  let min: string | null = null;
  let max: string | null = null;

  for (const record of records) {
    const date = record.renewal_effective_date;
    if (date) {
      if (!min || date < min) min = date;
      if (!max || date > max) max = date;
    }
  }

  return { min, max };
}
