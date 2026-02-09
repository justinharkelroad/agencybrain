/**
 * Parser for Allstate "New Business Details" Excel report
 *
 * This report is used for:
 * 1. Compensation calculations (aggregated by sub-producer)
 * 2. LQS sales sync (individual records)
 *
 * FILE LAYOUT:
 * - Rows 1-4: Metadata (Report title, Download Date, Downloaded By)
 * - Row 5: Column Headers
 * - Row 6+: Data rows
 * - Sheet name: "New Business Details"
 */

import * as XLSX from 'xlsx';

// Individual parsed row from the report
export interface NewBusinessRecord {
  agentNumber: string;
  subProducerCode: string | null;
  subProducerName: string | null;
  bindId: string | null;
  bindIdName: string | null;
  policyNumber: string;
  customerName: string;
  firstName: string;
  lastName: string;
  issuedDate: string; // YYYY-MM-DD
  dateWritten: string; // YYYY-MM-DD
  product: string;
  lineGroup: string;
  productDescription: string;
  packageType: string | null; // "Standard", "Gold Protection", or null
  transactionType: string;
  itemCount: number;
  writtenPremium: number; // In dollars (can be negative for cancellations)
  dispositionCode: string;
  rowNumber: number;
  // Chargeback classification
  isChargeback: boolean;
  chargebackReason: string | null; // Why this was classified as a chargeback
}

// Aggregated metrics by sub-producer for compensation
export interface SubProducerSalesMetrics {
  code: string;
  name: string | null;

  // Totals (new business only - positive premium)
  totalItems: number;
  totalPolicies: number;
  totalPremium: number;

  // Chargebacks (cancellations - negative premium or cancellation disposition)
  chargebackItems: number;
  chargebackPolicies: number;
  chargebackPremium: number; // Stored as positive value

  // Net
  netPremium: number;

  // By product type
  byProduct: {
    product: string;
    items: number;
    policies: number;
    premium: number;
    chargebackItems: number;
    chargebackPremium: number;
  }[];

  // By bundle type (monoline vs bundled - inferred from customer patterns)
  byBundleType: {
    bundleType: 'monoline' | 'standard' | 'preferred';
    items: number;
    premium: number;
    chargebackItems: number;
    chargebackPremium: number;
  }[];

  // Individual transactions for detail view
  transactions: NewBusinessRecord[];
  chargebackTransactions: NewBusinessRecord[];
}

export interface NewBusinessParseResult {
  success: boolean;
  records: NewBusinessRecord[];
  subProducerMetrics: SubProducerSalesMetrics[];
  errors: string[];
  dateRange: { start: string; end: string } | null;
  summary: {
    totalRecords: number;
    totalItems: number;
    totalPremium: number;
    totalPolicies: number;
    subProducerCount: number;
    endorsementsSkipped: number;
    // Chargeback summary
    chargebackRecords: number;
    chargebackItems: number;
    chargebackPremium: number;
    netPremium: number;
  };
}

/**
 * Chargeback disposition code patterns
 * These indicate a cancellation/refund that should be treated as a chargeback
 */
const CHARGEBACK_DISPOSITION_PATTERNS = [
  /cancel/i,
  /cancelled/i,
  /flat\s*cancel/i,
  /reinstatement/i, // Often has negative premium to reverse a cancellation
  /rescind/i,
  /rescission/i,
  /void/i,
  /refund/i,
  /reversal/i,
  /lapse/i,
  /non-?renew/i,
];

/**
 * Disposition codes that indicate new business (credits)
 */
const NEW_BUSINESS_DISPOSITION_PATTERNS = [
  /new\s*policy/i,
  /new\s*business/i,
  /policy\s*issued/i,
];

/**
 * Classify a record as a chargeback based on disposition code and premium
 * Returns { isChargeback: boolean, reason: string | null }
 */
function classifyChargeback(
  dispositionCode: string,
  writtenPremium: number,
  transactionType: string
): { isChargeback: boolean; reason: string | null } {
  const disp = (dispositionCode || '').trim();
  const trans = (transactionType || '').trim();

  // Rule 1: Negative premium is always a chargeback
  if (writtenPremium < 0) {
    return {
      isChargeback: true,
      reason: `Negative premium (${writtenPremium.toFixed(2)})`
    };
  }

  // Rule 2: Check disposition code for cancellation patterns
  for (const pattern of CHARGEBACK_DISPOSITION_PATTERNS) {
    if (pattern.test(disp)) {
      return {
        isChargeback: true,
        reason: `Disposition: ${disp}`
      };
    }
  }

  // Rule 3: Check transaction type for cancellation patterns
  for (const pattern of CHARGEBACK_DISPOSITION_PATTERNS) {
    if (pattern.test(trans)) {
      return {
        isChargeback: true,
        reason: `Transaction type: ${trans}`
      };
    }
  }

  // Not a chargeback
  return { isChargeback: false, reason: null };
}

/**
 * Check if a product is Auto (6-month term) vs Property (12-month term)
 */
function isAutoProduct(product: string): boolean {
  const p = (product || '').toLowerCase();
  return p.includes('auto') || p.includes('motorcycle') || p.includes('motor club');
}

/**
 * Calculate months between two dates
 */
function monthsBetween(dateStr1: string, dateStr2: string): number {
  // Parse YYYY-MM-DD format
  const [y1, m1] = dateStr1.split('-').map(Number);
  const [y2, m2] = dateStr2.split('-').map(Number);
  return Math.abs((y2 - y1) * 12 + (m2 - m1));
}

/**
 * Determine if a record should be included based on first-term rules
 *
 * Include if:
 * 1. Transaction type contains "First Term" (explicit first-term indicator)
 * 2. It's a new policy (disposition = "New Policy Issued", etc.)
 * 3. It's a cancellation (negative premium or cancellation disposition)
 *
 * Exclude if:
 * - It's an endorsement/add-item that is NOT first term (old policy changes)
 */
function shouldIncludeRecord(
  dispositionCode: string,
  transactionType: string,
  product: string,
  dateWritten: string | null,
  reportEndDate: string | null,
  writtenPremium: number
): { include: boolean; reason: string } {
  const disp = (dispositionCode || '').trim();
  const trans = (transactionType || '').trim();
  const dispUpper = disp.toUpperCase();
  const transUpper = trans.toUpperCase();

  // Rule 1: If transaction type explicitly says "First Term", always include
  if (transUpper.includes('FIRST TERM')) {
    return { include: true, reason: 'First term transaction' };
  }

  // Rule 2: New policy dispositions - always include
  for (const pattern of NEW_BUSINESS_DISPOSITION_PATTERNS) {
    if (pattern.test(disp)) {
      return { include: true, reason: 'New business disposition' };
    }
  }

  // Rule 3: Cancellation patterns - always include (these are chargebacks)
  for (const pattern of CHARGEBACK_DISPOSITION_PATTERNS) {
    if (pattern.test(disp) || pattern.test(trans)) {
      return { include: true, reason: 'Cancellation/chargeback' };
    }
  }

  // Rule 4: Negative premium - always include as chargeback
  if (writtenPremium < 0) {
    return { include: true, reason: 'Negative premium' };
  }

  // Rule 5: Check if this is an endorsement/add-item
  const endorsementPatterns = [
    /endorsement/i,
    /add\s*item/i,
    /add\s*coverage/i,
    /drop\s*item/i,
    /drop\s*coverage/i,
    /coverage\s*change/i,
    /policy\s*change/i,
  ];

  const isEndorsement = endorsementPatterns.some(p => p.test(disp) || p.test(trans));

  if (isEndorsement) {
    // For endorsements without "First Term" label, check date-based first-term window
    if (dateWritten && reportEndDate) {
      const termMonths = isAutoProduct(product) ? 6 : 12;
      const monthsOld = monthsBetween(dateWritten, reportEndDate);

      if (monthsOld <= termMonths) {
        return { include: true, reason: `Endorsement within ${termMonths}-month first term` };
      }
    }

    // Endorsement outside first term - exclude
    return { include: false, reason: 'Endorsement outside first term' };
  }

  // Rule 6: "Sales Issued" without other indicators - include as new business
  if (transUpper.includes('SALES ISSUED') || transUpper.includes('NEW ISSUED')) {
    return { include: true, reason: 'Sales/new issued transaction' };
  }

  // Default: include (we'll classify as credit or chargeback later)
  return { include: true, reason: 'Default include' };
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
 * Parse currency to dollars: "$1,234.56" -> 1234.56
 */
function parseCurrency(value: any): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return value;
  const numStr = String(value).replace(/[$,]/g, '');
  const num = parseFloat(numStr);
  return isNaN(num) ? 0 : num;
}

/**
 * Parse customer name: "JOHN SMITH" -> { firstName: "JOHN", lastName: "SMITH" }
 */
function parseCustomerName(fullName: string): { firstName: string; lastName: string } {
  if (!fullName) return { firstName: '', lastName: '' };

  const str = fullName.trim().toUpperCase();
  const parts = str.split(/\s+/);

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }

  // Last word is last name, first word is first name (ignore middle names/initials)
  return {
    firstName: parts[0],
    lastName: parts[parts.length - 1],
  };
}

/**
 * Normalize product type to canonical form
 */
export function normalizeProductType(product: string): string {
  if (!product) return 'Unknown';

  const upper = product.toUpperCase().trim();

  const mapping: Record<string, string> = {
    'STANDARD AUTO': 'Auto',
    'AUTO': 'Auto',
    'HOMEOWNERS': 'Homeowners',
    'HOME': 'Homeowners',
    'RENTERS': 'Renters',
    'RENTER': 'Renters',
    'LANDLORDS': 'Landlord/Dwelling',
    'LANDLORD': 'Landlord/Dwelling',
    'PERSONAL UMBRELLA': 'Umbrella',
    'UMBRELLA': 'Umbrella',
    'SPECIALTY AUTO': 'Auto',
    'MOTOR CLUB': 'Motor Club',
    'SCHEDULED PERSONAL PROPERTY': 'Scheduled Property',
    'MANUFACTURED HOME': 'Manufactured Home',
    'CONDO': 'Condo',
    'CONDOMINIUM': 'Condo',
  };

  return mapping[upper] || product;
}

/**
 * Infer bundle type based on products sold to same customer
 * - Monoline: Single product (just auto OR just home)
 * - Standard: Auto + 1 property product
 * - Preferred: Auto + 2+ property products
 */
function inferBundleTypes(
  records: NewBusinessRecord[]
): Map<string, 'monoline' | 'standard' | 'preferred'> {
  // Group by customer (using policy number prefix or customer name)
  const customerProducts = new Map<string, Set<string>>();

  for (const record of records) {
    // Use customer name as key (uppercase, normalized)
    const key = record.customerName.toUpperCase().replace(/\s+/g, '_');

    if (!customerProducts.has(key)) {
      customerProducts.set(key, new Set());
    }

    const products = customerProducts.get(key)!;
    const normalizedProduct = normalizeProductType(record.product);

    // Categorize as auto or property
    if (normalizedProduct === 'Auto') {
      products.add('AUTO');
    } else if (['Homeowners', 'Renters', 'Condo', 'Landlord/Dwelling', 'Manufactured Home'].includes(normalizedProduct)) {
      products.add('PROPERTY');
    }
  }

  // Determine bundle type for each customer
  const customerBundleType = new Map<string, 'monoline' | 'standard' | 'preferred'>();

  for (const [key, products] of customerProducts) {
    const hasAuto = products.has('AUTO');
    const propertyCount = [...products].filter(p => p === 'PROPERTY').length;

    if (hasAuto && propertyCount >= 2) {
      customerBundleType.set(key, 'preferred');
    } else if (hasAuto && propertyCount === 1) {
      customerBundleType.set(key, 'standard');
    } else {
      customerBundleType.set(key, 'monoline');
    }
  }

  // Map back to records
  const recordBundleType = new Map<string, 'monoline' | 'standard' | 'preferred'>();

  for (const record of records) {
    const key = record.customerName.toUpperCase().replace(/\s+/g, '_');
    const bundleType = customerBundleType.get(key) || 'monoline';
    // Use policy number as unique identifier
    recordBundleType.set(record.policyNumber, bundleType);
  }

  return recordBundleType;
}

/**
 * Aggregate records by sub-producer
 * Separates credits (new business) from chargebacks (cancellations)
 */
function aggregateBySubProducer(
  records: NewBusinessRecord[],
  bundleTypes: Map<string, 'monoline' | 'standard' | 'preferred'>
): SubProducerSalesMetrics[] {
  const byProducer = new Map<string, SubProducerSalesMetrics>();

  for (const record of records) {
    const code = record.subProducerCode || 'UNASSIGNED';

    if (!byProducer.has(code)) {
      byProducer.set(code, {
        code,
        name: record.subProducerName,
        // Credits (new business)
        totalItems: 0,
        totalPolicies: 0,
        totalPremium: 0,
        // Chargebacks
        chargebackItems: 0,
        chargebackPolicies: 0,
        chargebackPremium: 0,
        // Net
        netPremium: 0,
        byProduct: [],
        byBundleType: [],
        transactions: [],
        chargebackTransactions: [],
      });
    }

    const metrics = byProducer.get(code)!;
    const normalizedProduct = normalizeProductType(record.product);
    const bundleType = bundleTypes.get(record.policyNumber) || 'monoline';

    // Find or create product entry
    let productEntry = metrics.byProduct.find(p => p.product === normalizedProduct);
    if (!productEntry) {
      productEntry = {
        product: normalizedProduct,
        items: 0,
        policies: 0,
        premium: 0,
        chargebackItems: 0,
        chargebackPremium: 0,
      };
      metrics.byProduct.push(productEntry);
    }

    // Find or create bundle type entry
    let bundleEntry = metrics.byBundleType.find(b => b.bundleType === bundleType);
    if (!bundleEntry) {
      bundleEntry = {
        bundleType,
        items: 0,
        premium: 0,
        chargebackItems: 0,
        chargebackPremium: 0,
      };
      metrics.byBundleType.push(bundleEntry);
    }

    if (record.isChargeback) {
      // This is a chargeback (cancellation)
      const absAmount = Math.abs(record.writtenPremium);
      metrics.chargebackItems += record.itemCount;
      metrics.chargebackPolicies += 1;
      metrics.chargebackPremium += absAmount;
      metrics.chargebackTransactions.push(record);

      productEntry.chargebackItems += record.itemCount;
      productEntry.chargebackPremium += absAmount;

      bundleEntry.chargebackItems += record.itemCount;
      bundleEntry.chargebackPremium += absAmount;
    } else {
      // This is a credit (new business)
      metrics.totalItems += record.itemCount;
      metrics.totalPolicies += 1;
      metrics.totalPremium += record.writtenPremium;
      metrics.transactions.push(record);

      productEntry.items += record.itemCount;
      productEntry.policies += 1;
      productEntry.premium += record.writtenPremium;

      bundleEntry.items += record.itemCount;
      bundleEntry.premium += record.writtenPremium;
    }
  }

  // Calculate net premium for each producer
  for (const metrics of byProducer.values()) {
    metrics.netPremium = metrics.totalPremium - metrics.chargebackPremium;
  }

  return Array.from(byProducer.values());
}

/**
 * Parse New Business Details Excel file
 */
export function parseNewBusinessDetails(file: ArrayBuffer): NewBusinessParseResult {
  const errors: string[] = [];
  const records: NewBusinessRecord[] = [];
  let endorsementsSkipped = 0;
  let minDate: string | null = null;
  let maxDate: string | null = null;

  try {
    const workbook = XLSX.read(file, { type: 'array' });

    // Find the target sheet - prefer "New Business Details"
    let sheetName = workbook.SheetNames.find(
      name => name.toLowerCase().includes('new business')
    );

    if (!sheetName) {
      // Fall back to first sheet or one with most data
      sheetName = workbook.SheetNames[0];
    }

    console.log('[NewBusiness Parser] Using sheet:', sheetName);

    const sheet = workbook.Sheets[sheetName];

    // Convert to JSON array - header is at row 5 (index 4)
    const rawData = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: null
    }) as any[][];

    // Find header row - look for rows containing expected column names
    let headerRowIndex = -1;
    const headerPatterns = ['agent number', 'sub producer', 'policy', 'issued date', 'item count', 'written premium'];

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
        subProducerMetrics: [],
        errors: ['Could not find header row. Expected columns like "Agent Number", "Sub Producer", "Policy No", etc.'],
        dateRange: null,
        summary: { totalRecords: 0, totalItems: 0, totalPremium: 0, totalPolicies: 0, subProducerCount: 0, endorsementsSkipped: 0, chargebackRecords: 0, chargebackItems: 0, chargebackPremium: 0, netPremium: 0 }
      };
    }

    // Get headers and trim whitespace (some columns have trailing spaces)
    const headers = rawData[headerRowIndex].map(h => String(h || '').trim());
    const dataRows = rawData.slice(headerRowIndex + 1);

    console.log('[NewBusiness Parser] Header row at index:', headerRowIndex);
    console.log('[NewBusiness Parser] Headers:', headers);
    console.log('[NewBusiness Parser] Data rows:', dataRows.length);

    // Build column index map
    const findColumn = (patterns: string[]): number => {
      for (let i = 0; i < headers.length; i++) {
        const lower = headers[i].toLowerCase();
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
      subProducer: findColumn(['sub producer']),
      subProducerName: findColumn(['sub-producer name', 'producer name']),
      bindId: findColumn(['bind id']),
      bindIdName: findColumn(['bind id name']),
      policyNo: findColumn(['policy no', 'policy number']),
      customerName: findColumn(['customer name']),
      issuedDate: findColumn(['issued date']),
      dateWritten: findColumn(['date written']),
      product: findColumn(['product']),
      lineGroup: findColumn(['line group']),
      productDescription: findColumn(['product description']),
      packageType: findColumn(['package']),
      transactionType: findColumn(['transaction type']),
      itemCount: findColumn(['item count']),
      writtenPremium: findColumn(['written premium']),
      dispositionCode: findColumn(['disposition code', 'disposition']),
    };

    console.log('[NewBusiness Parser] Column indices:', colIndex);

    // Validate required columns
    const requiredCols = ['policyNo', 'issuedDate', 'itemCount', 'writtenPremium'];
    const missingCols = requiredCols.filter(col => colIndex[col as keyof typeof colIndex] === -1);

    if (missingCols.length > 0) {
      return {
        success: false,
        records: [],
        subProducerMetrics: [],
        errors: [`Missing required columns: ${missingCols.join(', ')}`],
        dateRange: null,
        summary: { totalRecords: 0, totalItems: 0, totalPremium: 0, totalPolicies: 0, subProducerCount: 0, endorsementsSkipped: 0, chargebackRecords: 0, chargebackItems: 0, chargebackPremium: 0, netPremium: 0 }
      };
    }

    // FIRST PASS: Find the report's date range (needed for first-term calculations)
    let reportEndDate: string | null = null;
    for (let rowIdx = 0; rowIdx < dataRows.length; rowIdx++) {
      const row = dataRows[rowIdx];
      if (!row || row.every(cell => cell === null || cell === '')) continue;

      const getValue = (idx: number) => idx >= 0 && idx < row.length ? row[idx] : null;
      const issuedDate = parseDate(getValue(colIndex.issuedDate));

      if (issuedDate) {
        if (!reportEndDate || issuedDate > reportEndDate) {
          reportEndDate = issuedDate;
        }
      }
    }

    console.log('[NewBusiness Parser] Report end date (for first-term calc):', reportEndDate);

    // SECOND PASS: Process each data row with first-term filtering
    for (let rowIdx = 0; rowIdx < dataRows.length; rowIdx++) {
      const row = dataRows[rowIdx];
      const absoluteRowNum = rowIdx + headerRowIndex + 2; // Excel row number (1-indexed)

      if (!row || row.every(cell => cell === null || cell === '')) continue;

      const getValue = (idx: number) => idx >= 0 && idx < row.length ? row[idx] : null;

      // Get fields needed for inclusion check
      const dispositionCode = String(getValue(colIndex.dispositionCode) || '').trim();
      const transactionType = String(getValue(colIndex.transactionType) || '').trim();
      const product = String(getValue(colIndex.product) || '').trim();
      const writtenPremium = parseCurrency(getValue(colIndex.writtenPremium));
      const dateWritten = parseDate(getValue(colIndex.dateWritten));

      // Check if record should be included (first-term logic)
      const includeResult = shouldIncludeRecord(
        dispositionCode,
        transactionType,
        product,
        dateWritten,
        reportEndDate,
        writtenPremium
      );

      if (!includeResult.include) {
        endorsementsSkipped++;
        continue;
      }

      // Classify as chargeback or new business (credit)
      const { isChargeback, reason: chargebackReason } = classifyChargeback(
        dispositionCode,
        writtenPremium,
        transactionType
      );

      // Parse sub-producer code and name
      const subProducerRaw = String(getValue(colIndex.subProducer) || '').trim();
      let subProducerCode: string | null = null;
      let subProducerName: string | null = null;

      if (subProducerRaw) {
        // Accept plain numeric codes and mixed formats like "775 - J SMITH"
        const directCodeMatch = subProducerRaw.match(/^(\d{2,6})\b/);
        const embeddedCodeMatch = subProducerRaw.match(/\b(\d{2,6})\b/);
        subProducerCode = directCodeMatch?.[1] || embeddedCodeMatch?.[1] || null;
      }

      // Get name from separate column if available
      if (colIndex.subProducerName >= 0) {
        const nameRaw = getValue(colIndex.subProducerName);
        if (nameRaw) {
          subProducerName = String(nameRaw).trim();
        }
      }

      // Parse dates
      const issuedDate = parseDate(getValue(colIndex.issuedDate));

      if (!issuedDate) {
        errors.push(`Row ${absoluteRowNum}: Invalid or missing Issued Date, skipped`);
        continue;
      }

      // Parse customer name
      const customerNameRaw = String(getValue(colIndex.customerName) || '').trim();
      const { firstName, lastName } = parseCustomerName(customerNameRaw);

      // Parse policy number
      const policyNumber = String(getValue(colIndex.policyNo) || '').trim();
      if (!policyNumber) {
        errors.push(`Row ${absoluteRowNum}: Missing Policy Number, skipped`);
        continue;
      }

      // Track date range
      if (!minDate || issuedDate < minDate) minDate = issuedDate;
      if (!maxDate || issuedDate > maxDate) maxDate = issuedDate;

      const record: NewBusinessRecord = {
        agentNumber: String(getValue(colIndex.agentNumber) || '').trim(),
        subProducerCode,
        subProducerName,
        bindId: getValue(colIndex.bindId) ? String(getValue(colIndex.bindId)).trim() : null,
        bindIdName: getValue(colIndex.bindIdName) ? String(getValue(colIndex.bindIdName)).trim() : null,
        policyNumber,
        customerName: customerNameRaw,
        firstName,
        lastName,
        issuedDate,
        dateWritten: dateWritten || issuedDate,
        product: String(getValue(colIndex.product) || 'Unknown').trim(),
        lineGroup: String(getValue(colIndex.lineGroup) || '').trim(),
        productDescription: String(getValue(colIndex.productDescription) || '').trim(),
        packageType: getValue(colIndex.packageType) ? String(getValue(colIndex.packageType)).trim() : null,
        transactionType,
        itemCount: parseInt(String(getValue(colIndex.itemCount) || '1')) || 1,
        writtenPremium,
        dispositionCode,
        rowNumber: absoluteRowNum,
        isChargeback,
        chargebackReason,
      };

      records.push(record);
    }

    if (records.length === 0) {
      return {
        success: false,
        records: [],
        subProducerMetrics: [],
        errors: endorsementsSkipped > 0
          ? [`No new policy records found. ${endorsementsSkipped} endorsements/add-items were skipped.`]
          : ['No valid records found in the file'],
        dateRange: null,
        summary: {
          totalRecords: 0,
          totalItems: 0,
          totalPremium: 0,
          totalPolicies: 0,
          subProducerCount: 0,
          endorsementsSkipped,
          chargebackRecords: 0,
          chargebackItems: 0,
          chargebackPremium: 0,
          netPremium: 0,
        }
      };
    }

    // Infer bundle types based on customer product combinations
    // Only use non-chargeback records for bundle inference
    const creditRecords = records.filter(r => !r.isChargeback);
    const bundleTypes = inferBundleTypes(creditRecords);

    // Aggregate by sub-producer
    const subProducerMetrics = aggregateBySubProducer(records, bundleTypes);

    // Separate credits from chargebacks for summary
    const chargebackRecords = records.filter(r => r.isChargeback);
    const totalCreditPremium = creditRecords.reduce((sum, r) => sum + r.writtenPremium, 0);
    const totalChargebackPremium = chargebackRecords.reduce((sum, r) => sum + Math.abs(r.writtenPremium), 0);

    // Calculate summary
    const summary = {
      totalRecords: creditRecords.length,
      totalItems: creditRecords.reduce((sum, r) => sum + r.itemCount, 0),
      totalPremium: totalCreditPremium,
      totalPolicies: creditRecords.length,
      subProducerCount: subProducerMetrics.length,
      endorsementsSkipped,
      // Chargeback stats
      chargebackRecords: chargebackRecords.length,
      chargebackItems: chargebackRecords.reduce((sum, r) => sum + r.itemCount, 0),
      chargebackPremium: totalChargebackPremium,
      netPremium: totalCreditPremium - totalChargebackPremium,
    };

    console.log('[NewBusiness Parser] Success:', summary);
    console.log(`[NewBusiness Parser] Credits: ${creditRecords.length} records, $${totalCreditPremium.toFixed(2)} premium`);
    console.log(`[NewBusiness Parser] Chargebacks: ${chargebackRecords.length} records, $${totalChargebackPremium.toFixed(2)} premium`);
    console.log(`[NewBusiness Parser] Net Premium: $${summary.netPremium.toFixed(2)}`);

    return {
      success: true,
      records,
      subProducerMetrics,
      errors,
      dateRange: minDate && maxDate ? { start: minDate, end: maxDate } : null,
      summary,
    };
  } catch (err) {
    return {
      success: false,
      records: [],
      subProducerMetrics: [],
      errors: [`Failed to parse Excel file: ${err instanceof Error ? err.message : 'Unknown error'}`],
      dateRange: null,
      summary: {
        totalRecords: 0,
        totalItems: 0,
        totalPremium: 0,
        totalPolicies: 0,
        subProducerCount: 0,
        endorsementsSkipped: 0,
        chargebackRecords: 0,
        chargebackItems: 0,
        chargebackPremium: 0,
        netPremium: 0,
      }
    };
  }
}

// Types matching the Comp Analyzer structures for compatibility
interface InsuredAggregate {
  insuredName: string;
  netPremium: number;
  netCommission: number;
  transactionCount: number;
}

interface SubProducerTransaction {
  policyNumber: string;
  insuredName: string;
  product: string;
  transType: string;
  premium: number;
  commission: number;
  origPolicyEffDate: string;
  isAuto: boolean;
  bundleType: string;
}

interface BundleTypeBreakdown {
  bundleType: string;
  premiumWritten: number;
  premiumChargebacks: number;
  netPremium: number;
  itemsIssued: number;
  creditCount: number;
  chargebackCount: number;
}

interface ProductBreakdown {
  product: string;
  premiumWritten: number;
  premiumChargebacks: number;
  netPremium: number;
  itemsIssued: number;
  creditCount: number;
  chargebackCount: number;
}

/**
 * Convert SubProducerSalesMetrics to the format expected by the compensation calculator
 * This bridges the new sales report format with the existing compensation system
 *
 * Includes creditInsureds and creditTransactions for the detail sheet display
 * Now also includes chargebackInsureds and chargebackTransactions
 */
export function convertToCompensationMetrics(
  metrics: SubProducerSalesMetrics[]
): Array<{
  code: string;
  name: string | null;
  displayName: string;
  itemsIssued: number;
  policiesIssued: number;
  premiumWritten: number;
  creditCount: number;
  netPremium: number;
  premiumChargebacks: number;
  chargebackCount: number;
  commissionEarned: number;
  commissionChargebacks: number;
  netCommission: number;
  effectiveRate: number;
  // Credit/chargeback detail data for PayoutDetailSheet
  creditInsureds: InsuredAggregate[];
  chargebackInsureds: InsuredAggregate[];
  creditTransactions: SubProducerTransaction[];
  chargebackTransactions: SubProducerTransaction[];
  // Breakdowns
  byBundleType: BundleTypeBreakdown[];
  byProduct: ProductBreakdown[];
}> {
  return metrics.map(m => {
    // Aggregate CREDIT transactions by customer name to create insured-level data
    const creditInsuredMap = new Map<string, {
      netPremium: number;
      netCommission: number;
      transactionCount: number;
    }>();

    console.log(`[convertToCompensationMetrics] Processing sub-producer ${m.code}`);
    console.log(`  - ${m.transactions.length} credit transactions, ${m.chargebackTransactions.length} chargeback transactions`);

    for (const tx of m.transactions) {
      const key = tx.customerName.toUpperCase().trim();
      const existing = creditInsuredMap.get(key) || { netPremium: 0, netCommission: 0, transactionCount: 0 };
      existing.netPremium += tx.writtenPremium;
      existing.netCommission += tx.writtenPremium * 0.15; // Approximate commission (15% default)
      existing.transactionCount += 1;
      creditInsuredMap.set(key, existing);
    }

    // Convert to creditInsureds array
    const creditInsureds: InsuredAggregate[] = Array.from(creditInsuredMap.entries()).map(([name, data]) => ({
      insuredName: name,
      netPremium: data.netPremium,
      netCommission: data.netCommission,
      transactionCount: data.transactionCount,
    }));

    // Aggregate CHARGEBACK transactions by customer name
    const chargebackInsuredMap = new Map<string, {
      netPremium: number;
      netCommission: number;
      transactionCount: number;
    }>();

    for (const tx of m.chargebackTransactions) {
      const key = tx.customerName.toUpperCase().trim();
      const existing = chargebackInsuredMap.get(key) || { netPremium: 0, netCommission: 0, transactionCount: 0 };
      // Store as negative values for chargebacks
      const absAmount = Math.abs(tx.writtenPremium);
      existing.netPremium -= absAmount;  // Negative premium for chargebacks
      existing.netCommission -= absAmount * 0.15;
      existing.transactionCount += 1;
      chargebackInsuredMap.set(key, existing);
    }

    // Convert to chargebackInsureds array
    const chargebackInsureds: InsuredAggregate[] = Array.from(chargebackInsuredMap.entries()).map(([name, data]) => ({
      insuredName: name,
      netPremium: data.netPremium,  // Will be negative
      netCommission: data.netCommission,  // Will be negative
      transactionCount: data.transactionCount,
    }));

    console.log(`[convertToCompensationMetrics] Sub-producer ${m.code}: ${creditInsureds.length} credits, ${chargebackInsureds.length} chargebacks`);

    // Convert credit transactions to SubProducerTransaction format
    const creditTransactions: SubProducerTransaction[] = m.transactions.map(tx => {
      const normalizedProduct = normalizeProductType(tx.product);
      const isAuto = normalizedProduct === 'Auto';
      return {
        policyNumber: tx.policyNumber,
        insuredName: tx.customerName,
        product: normalizedProduct,
        transType: 'New Business',
        premium: tx.writtenPremium,
        commission: tx.writtenPremium * 0.15,
        origPolicyEffDate: tx.issuedDate.replace(/-/g, '/'),
        isAuto,
        bundleType: tx.packageType || 'Monoline',
      };
    });

    // Convert chargeback transactions to SubProducerTransaction format
    const chargebackTransactions: SubProducerTransaction[] = m.chargebackTransactions.map(tx => {
      const normalizedProduct = normalizeProductType(tx.product);
      const isAuto = normalizedProduct === 'Auto';
      const absAmount = Math.abs(tx.writtenPremium);
      return {
        policyNumber: tx.policyNumber,
        insuredName: tx.customerName,
        product: normalizedProduct,
        transType: tx.chargebackReason || 'Cancellation',
        premium: -absAmount,  // Negative for chargebacks
        commission: -absAmount * 0.15,
        origPolicyEffDate: tx.issuedDate.replace(/-/g, '/'),
        isAuto,
        bundleType: tx.packageType || 'Monoline',
      };
    });

    // Build bundle type breakdowns with full structure (including chargebacks)
    const byBundleType: BundleTypeBreakdown[] = m.byBundleType.map(b => ({
      bundleType: b.bundleType,
      premiumWritten: b.premium,
      premiumChargebacks: b.chargebackPremium,
      netPremium: b.premium - b.chargebackPremium,
      itemsIssued: b.items,
      creditCount: b.items,
      chargebackCount: b.chargebackItems,
    }));

    // Build product breakdowns with full structure (including chargebacks)
    const byProduct: ProductBreakdown[] = m.byProduct.map(p => ({
      product: p.product,
      premiumWritten: p.premium,
      premiumChargebacks: p.chargebackPremium,
      netPremium: p.premium - p.chargebackPremium,
      itemsIssued: p.items,
      creditCount: p.policies,
      chargebackCount: p.chargebackItems,
    }));

    // Calculate commission values
    const commissionEarned = m.totalPremium * 0.15;
    const commissionChargebacks = m.chargebackPremium * 0.15;
    const netCommission = commissionEarned - commissionChargebacks;

    return {
      code: m.code,
      name: m.name,
      displayName: m.name || `Sub-Producer: ${m.code}`,
      itemsIssued: m.totalItems,
      policiesIssued: m.totalPolicies,
      premiumWritten: m.totalPremium,
      creditCount: creditInsureds.length,
      netPremium: m.netPremium,
      premiumChargebacks: m.chargebackPremium,
      chargebackCount: chargebackInsureds.length,
      commissionEarned,
      commissionChargebacks,
      netCommission,
      effectiveRate: m.netPremium !== 0 ? (netCommission / m.netPremium) * 100 : 15,
      // Credit/chargeback detail data
      creditInsureds,
      chargebackInsureds,
      creditTransactions,
      chargebackTransactions,
      // Breakdowns
      byBundleType,
      byProduct,
    };
  });
}
