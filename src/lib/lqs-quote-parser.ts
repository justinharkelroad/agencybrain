import * as XLSX from 'xlsx';
import type { ParsedQuoteRow, QuoteParseResult } from '@/types/lqs';

/**
 * Generate household key: LASTNAME_FIRSTNAME_ZIPCODE (first 5 chars)
 * When ZIP is missing, uses "NOZIP" to prevent incorrect merging
 */
export function generateHouseholdKey(firstName: string, lastName: string, zipCode: string | null): string {
  const normalizedLast = (lastName || 'UNKNOWN').toUpperCase().trim().replace(/[^A-Z]/g, '');
  const normalizedFirst = (firstName || 'UNKNOWN').toUpperCase().trim().replace(/[^A-Z]/g, '');
  const normalizedZip = zipCode ? zipCode.substring(0, 5) : 'NOZIP';
  return `${normalizedLast}_${normalizedFirst}_${normalizedZip}`;
}

/**
 * Extract sub-producer code and name from values like:
 * - "009" → code: "009", name: null
 * - "723-ANTHONY MCDERMOTT" → code: "723", name: "ANTHONY MCDERMOTT"
 */
function parseSubProducer(value: string): { code: string | null; name: string | null } {
  if (!value || !value.trim()) return { code: null, name: null };
  
  const trimmed = value.trim();
  const hyphenIndex = trimmed.indexOf('-');
  
  if (hyphenIndex > 0) {
    const code = trimmed.substring(0, hyphenIndex).trim();
    const name = trimmed.substring(hyphenIndex + 1).trim();
    return { code: code || null, name: name || null };
  }
  
  // Check if it's just a number
  if (/^\d+$/.test(trimmed)) {
    return { code: trimmed, name: null };
  }
  
  return { code: null, name: trimmed };
}

/**
 * Parse currency string to cents: "$1,234.56" -> 123456
 */
function parseCurrencyToCents(value: any): number {
  if (value === null || value === undefined || value === '') return 0;
  const numStr = String(value).replace(/[$,]/g, '');
  const num = parseFloat(numStr);
  return isNaN(num) ? 0 : Math.round(num * 100);
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
  
  // Handle string dates like "MM/DD/YYYY"
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

/**
 * Parse ZIP code: take first 5 characters, handle "18702-1234" format
 */
function parseZipCode(value: any): string {
  if (!value) return '00000';
  const str = String(value).trim();
  // Take first 5 digits
  const match = str.match(/^(\d{5})/);
  return match ? match[1] : '00000';
}

/**
 * Normalize product type to canonical form for consistent matching.
 * Mirrors the database normalize_product_type() function.
 */
export function normalizeProductType(productType: string): string {
  if (!productType || !productType.trim()) return 'Unknown';
  
  const upper = productType.toUpperCase().trim();
  
  const mapping: Record<string, string> = {
    // Auto variations
    'AUTO': 'Standard Auto',
    'STANDARD AUTO': 'Standard Auto',
    'PERSONAL AUTO': 'Standard Auto',
    'SA': 'Standard Auto',
    // Home variations
    'HOME': 'Homeowners',
    'HOMEOWNERS': 'Homeowners',
    'HOMEOWNER': 'Homeowners',
    'HO': 'Homeowners',
    // Renters variations
    'RENTER': 'Renters',
    'RENTERS': 'Renters',
    // Landlords variations
    'LANDLORD': 'Landlords',
    'LANDLORDS': 'Landlords',
    'LL': 'Landlords',
    // Umbrella variations
    'UMBRELLA': 'Personal Umbrella',
    'PERSONAL UMBRELLA': 'Personal Umbrella',
    'PUP': 'Personal Umbrella',
    // Motor Club variations
    'MOTOR CLUB': 'Motor Club',
    'MOTORCLUB': 'Motor Club',
    'MC': 'Motor Club',
    // Condo variations
    'CONDO': 'Condo',
    'CONDOMINIUM': 'Condo',
    // Mobilehome variations
    'MOBILEHOME': 'Mobilehome',
    'MOBILE HOME': 'Mobilehome',
    'MH': 'Mobilehome',
    // Auto Special variations
    'AUTO - SPECIAL': 'Auto - Special',
    'AUTO-SPECIAL': 'Auto - Special',
    'SPECIAL AUTO': 'Auto - Special',
    'NON-STANDARD AUTO': 'Auto - Special',
  };
  
  return mapping[upper] || productType; // Return original if no mapping found
}

/**
 * Find the target sheet containing quote data.
 * Looks for sheets with "detail" or "conversion" in name,
 * falls back to sheet with most rows.
 */
function findTargetSheet(workbook: XLSX.WorkBook): string {
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('No sheets found in workbook');
  }

  // Look for sheet with "Detail" or "Conversion" in the name
  for (const sheetName of workbook.SheetNames) {
    const lowerName = sheetName.toLowerCase();
    if (lowerName.includes('detail') || lowerName.includes('conversion')) {
      console.log('[Quote Parser] Found target sheet by name:', sheetName);
      return sheetName;
    }
  }
  
  // If multiple sheets, find the one with the most rows
  if (workbook.SheetNames.length > 1) {
    let maxRows = 0;
    let targetSheet = workbook.SheetNames[0];
    
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
      if (data.length > maxRows) {
        maxRows = data.length;
        targetSheet = sheetName;
      }
    }
    console.log('[Quote Parser] Using sheet with most rows:', targetSheet, 'rows:', maxRows);
    return targetSheet;
  }
  
  // Default to first sheet
  console.log('[Quote Parser] Using default first sheet:', workbook.SheetNames[0]);
  return workbook.SheetNames[0];
}

/**
 * Parse Allstate Quote Report Excel file
 * 
 * Expected structure:
 * - Rows 1-6: Metadata (skip)
 * - Row 7: Headers
 * - Row 8+: Data
 */
export function parseLqsQuoteExcel(file: ArrayBuffer): QuoteParseResult {
  const errors: string[] = [];
  const records: ParsedQuoteRow[] = [];
  const seenKeys = new Set<string>(); // For deduplication: household_key + quote_date + product_type
  let duplicatesRemoved = 0;
  let minDate: string | null = null;
  let maxDate: string | null = null;

  try {
    const workbook = XLSX.read(file, { type: 'array' });
    console.log('[Quote Parser] Total sheets in workbook:', workbook.SheetNames.length, 'Names:', workbook.SheetNames);
    
    const sheetName = findTargetSheet(workbook);
    const sheet = workbook.Sheets[sheetName];
    
    // Convert to JSON array of arrays
    const rawData = XLSX.utils.sheet_to_json(sheet, { 
      header: 1,
      defval: null 
    }) as any[][];

    // Find header row - search first 15 rows for "Sub Producer" or "Production Date"
    let headerRowIndex = -1;
    for (let i = 0; i < Math.min(15, rawData.length); i++) {
      const row = rawData[i];
      if (row) {
        const rowStr = row.map(cell => String(cell || '').toLowerCase()).join('|');
        if (rowStr.includes('sub producer') || rowStr.includes('production date')) {
          headerRowIndex = i;
          break;
        }
      }
    }

    if (headerRowIndex === -1) {
      return { 
        success: false, 
        records: [], 
        errors: ['Could not find header row. Expected columns like "Sub Producer" or "Production Date".'], 
        duplicatesRemoved: 0,
        dateRange: null
      };
    }

    const headers = rawData[headerRowIndex].map(h => String(h || '').trim());
    const dataRows = rawData.slice(headerRowIndex + 1);
    
    console.log('[Quote Parser] Header row found at index:', headerRowIndex);
    console.log('[Quote Parser] Total data rows to process:', dataRows.length);

    // Build column index map
    const colIndex: Record<string, number> = {};
    headers.forEach((header, idx) => {
      colIndex[header] = idx;
    });

    // Required columns check
    const requiredCols = ['Customer First Name', 'Customer Last Name', 'Production Date'];
    for (const col of requiredCols) {
      if (colIndex[col] === undefined) {
        return { 
          success: false, 
          records: [], 
          errors: [`Missing required column: ${col}`], 
          duplicatesRemoved: 0,
          dateRange: null
        };
      }
    }

    // Process each data row
    for (let rowIdx = 0; rowIdx < dataRows.length; rowIdx++) {
      const row = dataRows[rowIdx];
      const absoluteRowNum = rowIdx + headerRowIndex + 2; // Excel row number (1-indexed)
      
      if (!row || row.every(cell => cell === null || cell === '')) continue;

      const getValue = (colName: string) => {
        const idx = colIndex[colName];
        return idx !== undefined ? row[idx] : null;
      };

      // Extract fields
      const firstName = String(getValue('Customer First Name') || '').trim();
      const lastName = String(getValue('Customer Last Name') || '').trim();
      
      if (!firstName && !lastName) {
        errors.push(`Row ${absoluteRowNum}: Missing customer name, skipped`);
        continue;
      }

      const quoteDateRaw = getValue('Production Date');
      const quoteDate = parseDate(quoteDateRaw);
      
      if (!quoteDate) {
        errors.push(`Row ${absoluteRowNum}: Invalid or missing Production Date, skipped`);
        continue;
      }

      const subProducerRaw = String(getValue('Sub Producer') || '').trim();
      const { code: subProducerCode, name: subProducerName } = parseSubProducer(subProducerRaw);
      
      const zipCode = parseZipCode(getValue('Customer ZIP Code'));
      const productType = normalizeProductType(String(getValue('Product') || 'Unknown').trim());
      const itemsQuoted = parseInt(String(getValue('Quoted Item Count') || '1')) || 1;
      const premiumCents = parseCurrencyToCents(getValue('Quoted Premium($)'));
      const issuedPolicyNumber = getValue('Issued Policy #') ? String(getValue('Issued Policy #')).trim() : null;
      
      const householdKey = generateHouseholdKey(firstName, lastName, zipCode);
      
      // Deduplication key: household_key + quote_date + product_type
      const dedupeKey = `${householdKey}|${quoteDate}|${productType}`;
      if (seenKeys.has(dedupeKey)) {
        duplicatesRemoved++;
        continue;
      }
      seenKeys.add(dedupeKey);

      // Track date range
      if (!minDate || quoteDate < minDate) minDate = quoteDate;
      if (!maxDate || quoteDate > maxDate) maxDate = quoteDate;

      records.push({
        subProducerRaw,
        subProducerCode,
        subProducerName,
        firstName,
        lastName,
        zipCode,
        quoteDate,
        productType,
        itemsQuoted,
        premiumCents,
        issuedPolicyNumber,
        householdKey,
        rowNumber: absoluteRowNum,
      });
    }

    if (records.length === 0) {
      return { 
        success: false, 
        records: [], 
        errors: ['No valid records found in the file'], 
        duplicatesRemoved,
        dateRange: null
      };
    }

    console.log('[Quote Parser] Records parsed:', records.length, 'Errors:', errors.length, 'Duplicates removed:', duplicatesRemoved);

    return { 
      success: true, 
      records, 
      errors, 
      duplicatesRemoved,
      dateRange: minDate && maxDate ? { start: minDate, end: maxDate } : null
    };
  } catch (err) {
    return { 
      success: false, 
      records: [], 
      errors: [`Failed to parse Excel file: ${err instanceof Error ? err.message : 'Unknown error'}`],
      duplicatesRemoved: 0,
      dateRange: null
    };
  }
}
