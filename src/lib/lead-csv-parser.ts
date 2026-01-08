import * as XLSX from 'xlsx';
import { generateHouseholdKey } from './lqs-quote-parser';
import type { ParsedLeadRow, LeadColumnMapping, ParsedLeadFileResult } from '@/types/lqs';

/**
 * Smart column name detection for auto-mapping
 * Returns the field key and whether it's a phone column
 */
function suggestColumnMapping(columnName: string): { key: keyof LeadColumnMapping; isPhone: boolean } | null {
  const lower = columnName.toLowerCase().trim();
  
  // First name patterns
  if (lower.includes('first') && lower.includes('name')) return { key: 'first_name', isPhone: false };
  if (lower === 'first' || lower === 'firstname') return { key: 'first_name', isPhone: false };
  if (lower === 'fname') return { key: 'first_name', isPhone: false };
  
  // Last name patterns
  if (lower.includes('last') && lower.includes('name')) return { key: 'last_name', isPhone: false };
  if (lower === 'last' || lower === 'lastname') return { key: 'last_name', isPhone: false };
  if (lower === 'lname') return { key: 'last_name', isPhone: false };
  if (lower === 'surname') return { key: 'last_name', isPhone: false };
  
  // ZIP patterns
  if (lower.includes('zip') || lower.includes('postal')) return { key: 'zip_code', isPhone: false };
  if (lower === 'postcode' || lower === 'zipcode') return { key: 'zip_code', isPhone: false };
  
  // Phone patterns - mark as phone for multi-column collection
  if (lower.includes('phone') || lower.includes('tel') || lower.includes('mobile') || lower.includes('cell')) {
    return { key: 'phones', isPhone: true };
  }
  
  // Email patterns
  if (lower.includes('email') || lower.includes('e-mail')) return { key: 'email', isPhone: false };
  
  // Products patterns
  if (lower.includes('product') || lower.includes('interest') || lower.includes('line')) {
    return { key: 'products_interested', isPhone: false };
  }
  
  // Date patterns
  if (lower.includes('date') || lower.includes('received') || lower.includes('created')) {
    return { key: 'lead_date', isPhone: false };
  }
  
  return null;
}

/**
 * Parse a lead file (CSV or Excel) and return headers with sample data
 */
export function parseLeadFile(file: ArrayBuffer, fileName: string): ParsedLeadFileResult {
  const errors: string[] = [];
  
  try {
    const workbook = XLSX.read(file, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // Convert to JSON array of arrays
    const rawData = XLSX.utils.sheet_to_json(sheet, { 
      header: 1,
      defval: '' 
    }) as any[][];

    if (rawData.length === 0) {
      return {
        success: false,
        headers: [],
        sampleRows: [],
        allRows: [],
        totalRows: 0,
        suggestedMapping: createEmptyMapping(),
        errors: ['File is empty'],
      };
    }

    // First row is headers
    const headers = rawData[0].map((h: any) => String(h || '').trim()).filter(Boolean);
    const dataRows = rawData.slice(1).filter(row => row.some(cell => cell !== '' && cell !== null));

    if (headers.length === 0) {
      return {
        success: false,
        headers: [],
        sampleRows: [],
        allRows: [],
        totalRows: 0,
        suggestedMapping: createEmptyMapping(),
        errors: ['No headers found in file'],
      };
    }

    // Build sample rows (first 3 data rows)
    const sampleRows: Record<string, string>[] = [];
    for (let i = 0; i < Math.min(3, dataRows.length); i++) {
      const row = dataRows[i];
      const sampleRow: Record<string, string> = {};
      headers.forEach((header, idx) => {
        sampleRow[header] = String(row[idx] || '');
      });
      sampleRows.push(sampleRow);
    }

    // Auto-suggest column mappings - collect ALL phone columns
    const suggestedMapping = createEmptyMapping();
    const usedColumns = new Set<string>();
    const phoneColumns: string[] = [];
    
    for (const header of headers) {
      const suggested = suggestColumnMapping(header);
      if (suggested) {
        if (suggested.isPhone) {
          // Collect all phone columns
          phoneColumns.push(header);
        } else if (!usedColumns.has(suggested.key)) {
          // For non-phone fields, use first match
          (suggestedMapping as any)[suggested.key] = header;
          usedColumns.add(suggested.key);
        }
      }
    }
    
    // Set all detected phone columns
    suggestedMapping.phones = phoneColumns.length > 0 ? phoneColumns : null;

    return {
      success: true,
      headers,
      sampleRows,
      allRows: dataRows,
      totalRows: dataRows.length,
      suggestedMapping,
      errors,
    };
  } catch (err) {
    return {
      success: false,
      headers: [],
      sampleRows: [],
      allRows: [],
      totalRows: 0,
      suggestedMapping: createEmptyMapping(),
      errors: [`Failed to parse file: ${err instanceof Error ? err.message : 'Unknown error'}`],
    };
  }
}

function createEmptyMapping(): LeadColumnMapping {
  return {
    first_name: null,
    last_name: null,
    zip_code: null,
    phones: null,  // Array of column names
    email: null,
    products_interested: null,
    lead_date: null,
  };
}

/**
 * Parse ZIP code: take first 5 characters
 */
function parseZipCode(value: any): string {
  if (!value) return '00000';
  const str = String(value).trim();
  const match = str.match(/^(\d{5})/);
  return match ? match[1] : '00000';
}

/**
 * Parse date from various formats to YYYY-MM-DD
 */
function parseDate(value: any): string | null {
  if (!value) return null;
  
  // Handle Excel serial dates
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
    }
  }
  
  const strValue = String(value).trim();
  
  // Handle MM/DD/YYYY
  const match1 = strValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match1) {
    const [, month, day, year] = match1;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // Handle YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(strValue)) {
    return strValue.substring(0, 10);
  }
  
  return null;
}

/**
 * Parse products interested - handle comma-separated values
 */
function parseProductsInterested(value: any): string[] | null {
  if (!value) return null;
  const str = String(value).trim();
  if (!str) return null;
  
  // Split by comma and clean up
  const products = str.split(',').map(p => p.trim()).filter(Boolean);
  return products.length > 0 ? products : null;
}

/**
 * Clean phone number - returns cleaned string or null
 */
function cleanPhone(value: any): string | null {
  if (!value) return null;
  const str = String(value).trim();
  if (!str) return null;
  // Remove non-digit characters for storage, keep formatted for display
  return str;
}

/**
 * Apply column mapping to raw data rows and return parsed lead rows
 */
export function applyLeadColumnMapping(
  allRows: any[][],
  headers: string[],
  mapping: LeadColumnMapping
): { records: ParsedLeadRow[]; errors: Array<{ row: number; message: string }> } {
  const records: ParsedLeadRow[] = [];
  const errors: Array<{ row: number; message: string }> = [];
  const seenHouseholdKeys = new Set<string>();

  // Build header index map
  const headerIndex: Record<string, number> = {};
  headers.forEach((h, idx) => {
    headerIndex[h] = idx;
  });

  const getValue = (row: any[], columnName: string | null): any => {
    if (!columnName) return null;
    const idx = headerIndex[columnName];
    return idx !== undefined ? row[idx] : null;
  };

  for (let i = 0; i < allRows.length; i++) {
    const row = allRows[i];
    const rowNumber = i + 2; // 1-indexed, accounting for header row

    try {
      const firstName = String(getValue(row, mapping.first_name) || '').trim();
      const lastName = String(getValue(row, mapping.last_name) || '').trim();
      const zipCodeRaw = getValue(row, mapping.zip_code);
      
      // Validate required fields
      if (!firstName) {
        errors.push({ row: rowNumber, message: 'Missing First Name' });
        continue;
      }
      if (!lastName) {
        errors.push({ row: rowNumber, message: 'Missing Last Name' });
        continue;
      }
      if (!zipCodeRaw) {
        errors.push({ row: rowNumber, message: 'Missing ZIP Code' });
        continue;
      }

      const zipCode = parseZipCode(zipCodeRaw);
      const householdKey = generateHouseholdKey(firstName, lastName, zipCode);

      // Skip duplicates within the file
      if (seenHouseholdKeys.has(householdKey)) {
        continue; // Silently skip duplicates
      }
      seenHouseholdKeys.add(householdKey);

      // Collect ALL phone values from mapped columns
      const phones: string[] = [];
      if (mapping.phones && Array.isArray(mapping.phones)) {
        for (const colName of mapping.phones) {
          const val = cleanPhone(getValue(row, colName));
          if (val) phones.push(val);
        }
      }
      
      const email = getValue(row, mapping.email) ? String(getValue(row, mapping.email)).trim() || null : null;
      const productsInterested = parseProductsInterested(getValue(row, mapping.products_interested));
      const leadDate = parseDate(getValue(row, mapping.lead_date));

      records.push({
        firstName,
        lastName,
        zipCode,
        phones: phones.length > 0 ? phones : null,
        email,
        productsInterested,
        leadDate,
        rowNumber,
        householdKey,
      });
    } catch (err) {
      errors.push({ row: rowNumber, message: err instanceof Error ? err.message : 'Unknown error' });
    }
  }

  return { records, errors };
}
