import * as XLSX from 'xlsx';
import type { ParsedSaleRow, SalesParseResult } from '@/types/lqs';

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
 * Returns null if no valid ZIP found
 */
function parseZipCode(value: any): string | null {
  if (!value) return null;
  const str = String(value).trim();
  if (!str) return null;
  // Take first 5 digits
  const match = str.match(/^(\d{5})/);
  return match ? match[1] : null;
}

/**
 * Parse customer name from combined format:
 * - "JOHN SMITH" → { firstName: "JOHN", lastName: "SMITH" }
 * - "SMITH" → { firstName: "", lastName: "SMITH" }
 */
function parseCustomerName(fullName: string): { firstName: string; lastName: string } {
  if (!fullName) return { firstName: '', lastName: '' };
  
  const str = fullName.trim().toUpperCase();
  
  // Check for "LAST, FIRST" format
  if (str.includes(',')) {
    const parts = str.split(',').map(p => p.trim());
    return {
      lastName: parts[0] || '',
      firstName: parts[1]?.split(' ')[0] || '', // Take first name only
    };
  }
  
  // Otherwise "FIRST LAST" format
  const parts = str.split(/\s+/);
  if (parts.length === 1) {
    return { firstName: '', lastName: parts[0] };
  }
  
  // Last word is last name, everything else is first name
  const lastName = parts[parts.length - 1];
  const firstName = parts.slice(0, -1).join(' ');
  return { firstName, lastName };
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
  
  return mapping[upper] || productType;
}

/**
 * Find the target sheet containing sales data.
 * Looks for sheets with "sale" or "sold" in name,
 * falls back to sheet with most rows.
 */
function findTargetSheet(workbook: XLSX.WorkBook): string {
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('No sheets found in workbook');
  }

  // Look for sheet with "Sale" or "Sold" in the name
  for (const sheetName of workbook.SheetNames) {
    const lowerName = sheetName.toLowerCase();
    if (lowerName.includes('sale') || lowerName.includes('sold') || lowerName.includes('issued')) {
      console.log('[Sales Parser] Found target sheet by name:', sheetName);
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
    console.log('[Sales Parser] Using sheet with most rows:', targetSheet, 'rows:', maxRows);
    return targetSheet;
  }
  
  // Default to first sheet
  console.log('[Sales Parser] Using default first sheet:', workbook.SheetNames[0]);
  return workbook.SheetNames[0];
}

/**
 * Parse name from various formats:
 * - "SMITH, JOHN" → { firstName: "JOHN", lastName: "SMITH" }
 * - "JOHN SMITH" → { firstName: "JOHN", lastName: "SMITH" }
 */
function parseName(value: any): { firstName: string; lastName: string } {
  if (!value) return { firstName: 'UNKNOWN', lastName: 'UNKNOWN' };
  
  const str = String(value).trim().toUpperCase();
  
  // Check for "LAST, FIRST" format
  if (str.includes(',')) {
    const parts = str.split(',').map(p => p.trim());
    return {
      lastName: parts[0] || 'UNKNOWN',
      firstName: parts[1]?.split(' ')[0] || 'UNKNOWN', // Take first name only
    };
  }
  
  // Otherwise "FIRST LAST" format
  const parts = str.split(/\s+/);
  if (parts.length >= 2) {
    return {
      firstName: parts[0],
      lastName: parts[parts.length - 1], // Take last word as last name
    };
  }
  
  return { firstName: str, lastName: 'UNKNOWN' };
}

/**
 * Parse Allstate Sales Report Excel file
 * 
 * Expected structure similar to Quote Report
 */
export function parseLqsSalesExcel(file: ArrayBuffer): SalesParseResult {
  const errors: string[] = [];
  const records: ParsedSaleRow[] = [];
  const seenKeys = new Set<string>(); // For deduplication
  let duplicatesRemoved = 0;
  let endorsementsSkipped = 0;
  let minDate: string | null = null;
  let maxDate: string | null = null;

  try {
    const workbook = XLSX.read(file, { type: 'array' });
    console.log('[Sales Parser] Total sheets in workbook:', workbook.SheetNames.length, 'Names:', workbook.SheetNames);
    
    const sheetName = findTargetSheet(workbook);
    const sheet = workbook.Sheets[sheetName];
    
    // Convert to JSON array of arrays
    const rawData = XLSX.utils.sheet_to_json(sheet, { 
      header: 1,
      defval: null 
    }) as any[][];

    // Find header row - search first 15 rows for common column names
    let headerRowIndex = -1;
    const headerPatterns = [
      'sub producer', 'producer', 'sale date', 'sold date', 'issue date',
      'first name', 'last name', 'customer', 'policy', 'premium'
    ];
    
    for (let i = 0; i < Math.min(15, rawData.length); i++) {
      const row = rawData[i];
      if (row) {
        const rowStr = row.map(cell => String(cell || '').toLowerCase()).join('|');
        const matchCount = headerPatterns.filter(p => rowStr.includes(p)).length;
        if (matchCount >= 2) {
          headerRowIndex = i;
          break;
        }
      }
    }

    if (headerRowIndex === -1) {
      return { 
        success: false, 
        records: [], 
        errors: ['Could not find header row. Expected columns like "First Name", "Last Name", "Sale Date", "Product", etc.'], 
        duplicatesRemoved: 0,
        endorsementsSkipped: 0,
        dateRange: null
      };
    }

    const headers = rawData[headerRowIndex].map(h => String(h || '').trim());
    const dataRows = rawData.slice(headerRowIndex + 1);
    
    console.log('[Sales Parser] Header row found at index:', headerRowIndex);
    console.log('[Sales Parser] Headers:', headers);
    console.log('[Sales Parser] Total data rows to process:', dataRows.length);

    // Build column index map with flexible matching
    const findColumn = (patterns: string[]): number => {
      for (const header of headers) {
        const lower = header.toLowerCase();
        for (const pattern of patterns) {
          if (lower.includes(pattern)) {
            return headers.indexOf(header);
          }
        }
      }
      return -1;
    };

    const colIndex = {
      subProducer: findColumn(['sub producer', 'sub-producer', 'producer']),
      // Try separate first/last name columns first
      firstName: findColumn(['first name', 'firstname']),
      lastName: findColumn(['last name', 'lastname']),
      // Fall back to combined customer name - use specific patterns to avoid matching "Sub-Producer Name"
      customerName: findColumn(['customer name', 'insured name', 'insured', 'customer']),
      // ZIP is optional
      zipCode: findColumn(['zip', 'postal', 'zip code']),
      saleDate: findColumn(['sale date', 'sold date', 'issue date', 'issued date', 'issued', 'effective']),
      productType: findColumn(['product', 'line', 'type']),
      itemsSold: findColumn(['items', 'item count', 'policies']),
      premium: findColumn(['premium']),
      policyNumber: findColumn(['policy', 'policy #', 'policy number']),
      dispositionCode: findColumn(['disposition', 'disposition code']),
    };

    // Determine if we have separate first/last name or combined customer name
    const hasSeparateNames = colIndex.firstName >= 0 && colIndex.lastName >= 0;
    const hasCustomerName = colIndex.customerName >= 0;

    // Validate that customer name and sub-producer aren't the same column
    if (colIndex.customerName >= 0 && colIndex.subProducer >= 0) {
      if (colIndex.customerName === colIndex.subProducer) {
        console.error('[Sales Parser] ERROR: Customer and Sub-Producer columns resolved to the same index!');
        errors.push('Column detection error: Customer Name and Sub-Producer are the same column');
      }
    }

    // Log column detection with header names
    if (hasSeparateNames) {
      console.log('[Sales Parser] Using separate First Name / Last Name columns');
    } else if (hasCustomerName) {
      console.log('[Sales Parser] Using Customer Name column (split)');
      console.log('[Sales Parser] Customer Name column index:', colIndex.customerName, 
                  '| Header:', headers[colIndex.customerName]);
    }
    
    if (colIndex.zipCode >= 0) {
      console.log('[Sales Parser] ZIP column found at index:', colIndex.zipCode);
    } else {
      console.log('[Sales Parser] ZIP column not found - proceeding without ZIP');
    }
    
    console.log('[Sales Parser] Disposition Code column index:', colIndex.dispositionCode);
    console.log('[Sales Parser] Sub-Producer column index:', colIndex.subProducer,
                '| Header:', colIndex.subProducer >= 0 ? headers[colIndex.subProducer] : 'N/A');

    if (!hasSeparateNames && !hasCustomerName) {
      return { 
        success: false, 
        records: [], 
        errors: ['Missing required name columns. Need either "First Name" + "Last Name" or "Customer Name"'], 
        duplicatesRemoved: 0,
        endorsementsSkipped: 0,
        dateRange: null
      };
    }

    // Process each data row
    for (let rowIdx = 0; rowIdx < dataRows.length; rowIdx++) {
      const row = dataRows[rowIdx];
      const absoluteRowNum = rowIdx + headerRowIndex + 2; // Excel row number (1-indexed)
      
      if (!row || row.every(cell => cell === null || cell === '')) continue;

      const getValue = (idx: number) => idx >= 0 ? row[idx] : null;

      // Check disposition code - skip endorsements
      let dispositionCode: string | null = null;
      if (colIndex.dispositionCode >= 0) {
        dispositionCode = String(getValue(colIndex.dispositionCode) || '').trim();
        
        // Skip if not "New Policy Issued" (case-insensitive)
        if (dispositionCode) {
          const upperDisposition = dispositionCode.toUpperCase();
          // Only accept "New Policy Issued" - skip "Add Item", endorsements, etc.
          if (!upperDisposition.includes('NEW POLICY') && !upperDisposition.includes('NEW BUSINESS')) {
            endorsementsSkipped++;
            continue;
          }
        }
      }

      // Extract name - prefer separate columns, fall back to combined
      let firstName: string;
      let lastName: string;
      
      if (hasSeparateNames) {
        firstName = String(getValue(colIndex.firstName) || '').trim().toUpperCase();
        lastName = String(getValue(colIndex.lastName) || '').trim().toUpperCase();
      } else if (hasCustomerName) {
        const parsed = parseCustomerName(String(getValue(colIndex.customerName) || ''));
        firstName = parsed.firstName;
        lastName = parsed.lastName;
      } else {
        errors.push(`Row ${absoluteRowNum}: No name columns found, skipped`);
        continue;
      }
      
      if (!firstName && !lastName) {
        errors.push(`Row ${absoluteRowNum}: Missing customer name, skipped`);
        continue;
      }

      const saleDateRaw = getValue(colIndex.saleDate);
      const saleDate = parseDate(saleDateRaw);
      
      if (!saleDate) {
        errors.push(`Row ${absoluteRowNum}: Invalid or missing Sale Date, skipped`);
        continue;
      }

      const subProducerRaw = colIndex.subProducer >= 0 
        ? String(getValue(colIndex.subProducer) || '').trim() 
        : '';
      const { code: subProducerCode, name: subProducerName } = parseSubProducer(subProducerRaw);
      
      // ZIP is optional - may be null if column missing or value empty
      const zipCode = colIndex.zipCode >= 0 ? parseZipCode(getValue(colIndex.zipCode)) : null;
      const productType = normalizeProductType(
        colIndex.productType >= 0 
          ? String(getValue(colIndex.productType) || 'Unknown').trim()
          : 'Unknown'
      );
      const itemsSold = colIndex.itemsSold >= 0 
        ? (parseInt(String(getValue(colIndex.itemsSold) || '1')) || 1)
        : 1;
      const premiumCents = colIndex.premium >= 0 
        ? parseCurrencyToCents(getValue(colIndex.premium))
        : 0;
      const policyNumber = colIndex.policyNumber >= 0 && getValue(colIndex.policyNumber)
        ? String(getValue(colIndex.policyNumber)).trim()
        : null;
      
      // Generate household key - use empty string for ZIP if null
      const householdKey = generateHouseholdKey(firstName, lastName, zipCode || '');
      
      // Deduplication key: policy_number if available, otherwise household_key + date + product
      const dedupeKey = policyNumber 
        ? `policy:${policyNumber}`
        : `${householdKey}|${saleDate}|${productType}`;
        
      if (seenKeys.has(dedupeKey)) {
        duplicatesRemoved++;
        continue;
      }
      seenKeys.add(dedupeKey);

      // Track date range
      if (!minDate || saleDate < minDate) minDate = saleDate;
      if (!maxDate || saleDate > maxDate) maxDate = saleDate;

      records.push({
        subProducerRaw,
        subProducerCode,
        subProducerName,
        firstName,
        lastName,
        zipCode,
        saleDate,
        productType,
        itemsSold,
        premiumCents,
        policyNumber,
        householdKey,
        rowNumber: absoluteRowNum,
        dispositionCode,
      });
    }

    if (records.length === 0) {
      return { 
        success: false, 
        records: [], 
        errors: endorsementsSkipped > 0 
          ? [`No new policy records found. ${endorsementsSkipped} endorsements were skipped.`]
          : ['No valid records found in the file'], 
        duplicatesRemoved,
        endorsementsSkipped,
        dateRange: null
      };
    }

    console.log('[Sales Parser] Processed:', records.length, ', Skipped:', endorsementsSkipped, ', Errors:', errors.length, ', Duplicates:', duplicatesRemoved);

    return { 
      success: true, 
      records, 
      errors, 
      duplicatesRemoved,
      endorsementsSkipped,
      dateRange: minDate && maxDate ? { start: minDate, end: maxDate } : null
    };
  } catch (err) {
    return { 
      success: false, 
      records: [], 
      errors: [`Failed to parse Excel file: ${err instanceof Error ? err.message : 'Unknown error'}`],
      duplicatesRemoved: 0,
      endorsementsSkipped: 0,
      dateRange: null
    };
  }
}
