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
  writtenPremium: number; // In dollars
  dispositionCode: string;
  rowNumber: number;
}

// Aggregated metrics by sub-producer for compensation
export interface SubProducerSalesMetrics {
  code: string;
  name: string | null;

  // Totals
  totalItems: number;
  totalPolicies: number;
  totalPremium: number;

  // By product type
  byProduct: {
    product: string;
    items: number;
    policies: number;
    premium: number;
  }[];

  // By bundle type (monoline vs bundled - inferred from customer patterns)
  byBundleType: {
    bundleType: 'monoline' | 'standard' | 'preferred';
    items: number;
    premium: number;
  }[];

  // Individual transactions for detail view
  transactions: NewBusinessRecord[];
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
        totalItems: 0,
        totalPolicies: 0,
        totalPremium: 0,
        byProduct: [],
        byBundleType: [],
        transactions: [],
      });
    }

    const metrics = byProducer.get(code)!;

    // Update totals
    metrics.totalItems += record.itemCount;
    metrics.totalPolicies += 1;
    metrics.totalPremium += record.writtenPremium;
    metrics.transactions.push(record);

    // Update by product
    const normalizedProduct = normalizeProductType(record.product);
    let productEntry = metrics.byProduct.find(p => p.product === normalizedProduct);
    if (!productEntry) {
      productEntry = { product: normalizedProduct, items: 0, policies: 0, premium: 0 };
      metrics.byProduct.push(productEntry);
    }
    productEntry.items += record.itemCount;
    productEntry.policies += 1;
    productEntry.premium += record.writtenPremium;

    // Update by bundle type
    const bundleType = bundleTypes.get(record.policyNumber) || 'monoline';
    let bundleEntry = metrics.byBundleType.find(b => b.bundleType === bundleType);
    if (!bundleEntry) {
      bundleEntry = { bundleType, items: 0, premium: 0 };
      metrics.byBundleType.push(bundleEntry);
    }
    bundleEntry.items += record.itemCount;
    bundleEntry.premium += record.writtenPremium;
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
        summary: { totalRecords: 0, totalItems: 0, totalPremium: 0, totalPolicies: 0, subProducerCount: 0, endorsementsSkipped: 0 }
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
        summary: { totalRecords: 0, totalItems: 0, totalPremium: 0, totalPolicies: 0, subProducerCount: 0, endorsementsSkipped: 0 }
      };
    }

    // Process each data row
    for (let rowIdx = 0; rowIdx < dataRows.length; rowIdx++) {
      const row = dataRows[rowIdx];
      const absoluteRowNum = rowIdx + headerRowIndex + 2; // Excel row number (1-indexed)

      if (!row || row.every(cell => cell === null || cell === '')) continue;

      const getValue = (idx: number) => idx >= 0 && idx < row.length ? row[idx] : null;

      // Check disposition code - only accept "New Policy Issued"
      const dispositionCode = String(getValue(colIndex.dispositionCode) || '').trim();
      if (dispositionCode) {
        const upperDisp = dispositionCode.toUpperCase();
        if (!upperDisp.includes('NEW POLICY') && !upperDisp.includes('NEW BUSINESS')) {
          endorsementsSkipped++;
          continue;
        }
      }

      // Parse sub-producer code and name
      const subProducerRaw = String(getValue(colIndex.subProducer) || '').trim();
      let subProducerCode: string | null = null;
      let subProducerName: string | null = null;

      if (subProducerRaw) {
        // Code is typically a 3-digit number like "775", "009"
        if (/^\d+$/.test(subProducerRaw)) {
          subProducerCode = subProducerRaw;
        }
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
      const dateWritten = parseDate(getValue(colIndex.dateWritten));

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
        transactionType: String(getValue(colIndex.transactionType) || '').trim(),
        itemCount: parseInt(String(getValue(colIndex.itemCount) || '1')) || 1,
        writtenPremium: parseCurrency(getValue(colIndex.writtenPremium)),
        dispositionCode,
        rowNumber: absoluteRowNum,
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
        summary: { totalRecords: 0, totalItems: 0, totalPremium: 0, totalPolicies: 0, subProducerCount: 0, endorsementsSkipped }
      };
    }

    // Infer bundle types based on customer product combinations
    const bundleTypes = inferBundleTypes(records);

    // Aggregate by sub-producer
    const subProducerMetrics = aggregateBySubProducer(records, bundleTypes);

    // Calculate summary
    const summary = {
      totalRecords: records.length,
      totalItems: records.reduce((sum, r) => sum + r.itemCount, 0),
      totalPremium: records.reduce((sum, r) => sum + r.writtenPremium, 0),
      totalPolicies: records.length,
      subProducerCount: subProducerMetrics.length,
      endorsementsSkipped,
    };

    console.log('[NewBusiness Parser] Success:', summary);

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
      summary: { totalRecords: 0, totalItems: 0, totalPremium: 0, totalPolicies: 0, subProducerCount: 0, endorsementsSkipped: 0 }
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
    // Aggregate transactions by customer name to create insured-level data
    const insuredMap = new Map<string, {
      netPremium: number;
      netCommission: number;
      transactionCount: number;
    }>();

    console.log(`[convertToCompensationMetrics] Processing sub-producer ${m.code} with ${m.transactions.length} transactions`);

    for (const tx of m.transactions) {
      const key = tx.customerName.toUpperCase().trim();
      const existing = insuredMap.get(key) || { netPremium: 0, netCommission: 0, transactionCount: 0 };
      existing.netPremium += tx.writtenPremium;
      existing.netCommission += tx.writtenPremium * 0.15; // Approximate commission (15% default)
      existing.transactionCount += 1;
      insuredMap.set(key, existing);
    }

    // Convert to creditInsureds array (all new business is credits)
    const creditInsureds: InsuredAggregate[] = Array.from(insuredMap.entries()).map(([name, data]) => ({
      insuredName: name,
      netPremium: data.netPremium,
      netCommission: data.netCommission,
      transactionCount: data.transactionCount,
    }));

    console.log(`[convertToCompensationMetrics] Sub-producer ${m.code}: ${creditInsureds.length} creditInsureds created`);

    // Convert transactions to SubProducerTransaction format
    const creditTransactions: SubProducerTransaction[] = m.transactions.map(tx => {
      const normalizedProduct = normalizeProductType(tx.product);
      const isAuto = normalizedProduct === 'Auto';
      return {
        policyNumber: tx.policyNumber,
        insuredName: tx.customerName,
        product: normalizedProduct,
        transType: 'New Business',
        premium: tx.writtenPremium,
        commission: tx.writtenPremium * 0.15, // Approximate commission
        origPolicyEffDate: tx.issuedDate.replace(/-/g, '/'), // Convert to MM/DD/YYYY format
        isAuto,
        bundleType: tx.packageType || 'Monoline',
      };
    });

    // Build bundle type breakdowns with full structure
    const byBundleType: BundleTypeBreakdown[] = m.byBundleType.map(b => ({
      bundleType: b.bundleType,
      premiumWritten: b.premium,
      premiumChargebacks: 0,
      netPremium: b.premium,
      itemsIssued: b.items,
      creditCount: b.items,
      chargebackCount: 0,
    }));

    // Build product breakdowns with full structure
    const byProduct: ProductBreakdown[] = m.byProduct.map(p => ({
      product: p.product,
      premiumWritten: p.premium,
      premiumChargebacks: 0,
      netPremium: p.premium,
      itemsIssued: p.items,
      creditCount: p.policies,
      chargebackCount: 0,
    }));

    return {
      code: m.code,
      name: m.name,
      displayName: m.name || `Sub-Producer: ${m.code}`,
      itemsIssued: m.totalItems,
      policiesIssued: m.totalPolicies,
      premiumWritten: m.totalPremium,
      creditCount: creditInsureds.length, // Count of unique customers
      netPremium: m.totalPremium, // No chargebacks in new business report
      premiumChargebacks: 0,
      chargebackCount: 0,
      commissionEarned: m.totalPremium * 0.15, // Approximate commission
      commissionChargebacks: 0,
      netCommission: m.totalPremium * 0.15,
      effectiveRate: 15, // Default rate
      // Credit/chargeback detail data
      creditInsureds,
      chargebackInsureds: [], // No chargebacks in new business report
      creditTransactions,
      chargebackTransactions: [], // No chargebacks in new business report
      // Breakdowns
      byBundleType,
      byProduct,
    };
  });
}
