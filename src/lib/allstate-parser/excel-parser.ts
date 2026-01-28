import * as XLSX from 'xlsx';

export interface StatementTransaction {
  rowNumber: number;
  policyNumber: string;
  namedInsured: string;
  product: string;
  transType: string;
  businessType: string;
  policyBundleType: string;
  writtenPremium: number;
  commissionablePremium: number;
  baseCommissionRate: number;
  baseCommissionAmount: number;
  vcRate: number;
  vcAmount: number;
  totalCommission: number;
  effectiveRate: number;
  // Additional fields for exclusion detection
  channel: string;
  serviceFeeAssignedDate: string;
  origPolicyEffDate: string;
  indicator: string;
  // Sub-producer tracking
  subProdCode: string;
  // Agent/Location tracking for multi-location support
  agentNumber?: string;
}

export interface ParsedStatement {
  agentNumber: string;
  agentName: string;
  transactions: StatementTransaction[];
  totals: {
    writtenPremium: number;
    baseCommission: number;
    variableComp: number;
    totalCommission: number;
  };
  parseErrors: string[];
}

// Parse currency/number value handling "$1,234.56" or plain numbers
function parseNumericValue(value: any): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return value;
  const numStr = String(value).replace(/[$,]/g, '').trim();
  const num = parseFloat(numStr);
  return isNaN(num) ? 0 : num;
}

// Parse percentage values like "9%" or 0.09
function parseRateValue(value: any): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') {
    // If > 1, assume percentage like 9 means 9%
    return value > 1 ? value / 100 : value;
  }
  const str = String(value).replace('%', '').trim();
  const num = parseFloat(str);
  if (isNaN(num)) return 0;
  return num > 1 ? num / 100 : num;
}

// Extract agent number from header area of the statement
function extractAgentNumber(sheet: XLSX.WorkSheet, data: any[][]): string {
  // Agent Number is typically in the header rows (before the data)
  // Look for "Agent Number" label or check common locations
  
  // Try to find it in the header area (first 15 rows)
  for (let row = 0; row < Math.min(15, data.length); row++) {
    const rowData = data[row];
    if (!rowData) continue;
    
    for (let col = 0; col < rowData.length; col++) {
      const cellValue = String(rowData[col] || '').toLowerCase().trim();
      
      // Check if this cell has "Agent Number" or similar label
      if (cellValue.includes('agent') && (cellValue.includes('number') || cellValue.includes('no') || cellValue.includes('#'))) {
        // Look for the value in the next cell or same cell after colon
        if (cellValue.includes(':')) {
          const parts = cellValue.split(':');
          if (parts.length > 1) {
            const value = parts[1].trim();
            if (value && /^\d+$/.test(value)) {
              return value;
            }
          }
        }
        // Check next cell
        if (col + 1 < rowData.length && rowData[col + 1]) {
          const nextValue = String(rowData[col + 1]).trim();
          if (/^\d+$/.test(nextValue)) {
            return nextValue;
          }
        }
      }
    }
  }
  
  // Fallback: Try to get from the Agent Number column in data rows
  // Find header row first
  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(25, data.length); i++) {
    const row = data[i];
    if (row && row.some(cell => String(cell || '').toLowerCase().includes('policy'))) {
      headerRowIndex = i;
      break;
    }
  }
  
  if (headerRowIndex >= 0) {
    const headers = data[headerRowIndex].map((h: any) => String(h || '').trim().toLowerCase());
    const agentColIndex = headers.findIndex(h => 
      h.includes('agent') && (h.includes('number') || h.includes('no') || h.includes('#'))
    );
    
    if (agentColIndex >= 0 && headerRowIndex + 1 < data.length) {
      const firstDataRow = data[headerRowIndex + 1];
      if (firstDataRow && firstDataRow[agentColIndex]) {
        return String(firstDataRow[agentColIndex]).trim();
      }
    }
  }
  
  return '';
}

export async function parseCompensationStatement(file: File): Promise<ParsedStatement> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  
  const errors: string[] = [];
  const transactions: StatementTransaction[] = [];
  
  // Convert to JSON array of arrays
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as any[][];
  
  // Extract agent number from header area
  const agentNumber = extractAgentNumber(sheet, data);
  
  // Find header row (look for "Policy Number" or similar)
  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(25, data.length); i++) {
    const row = data[i];
    if (row && row.some(cell => String(cell || '').toLowerCase().includes('policy'))) {
      headerRowIndex = i;
      break;
    }
  }
  
  if (headerRowIndex === -1) {
    errors.push('Could not find header row containing "Policy"');
    return {
      agentNumber,
      agentName: '',
      transactions: [],
      totals: { writtenPremium: 0, baseCommission: 0, variableComp: 0, totalCommission: 0 },
      parseErrors: errors
    };
  }
  
  // Build column index map from header row
  const headers = data[headerRowIndex].map((h: any) => String(h || '').trim());
  const colIndex: Record<string, number> = {};
  headers.forEach((header, idx) => {
    if (header) colIndex[header] = idx;
  });
  
  // Helper to find column by exact match first, then partial match
  const findColumnExact = (exactMatches: string[]): number => {
    for (const exact of exactMatches) {
      const idx = colIndex[exact];
      if (idx !== undefined) return idx;
    }
    return -1;
  };
  
  // Map columns using EXACT header matches based on Allstate statement format
  // These are the actual headers from the statement files
  const cols = {
    policyNumber: findColumnExact(['Policy Number']) !== -1 ? findColumnExact(['Policy Number']) : 4,
    namedInsured: findColumnExact(['Insured']) !== -1 ? findColumnExact(['Insured']) : 5,
    product: findColumnExact(['Product']) !== -1 ? findColumnExact(['Product']) : 2,
    transType: findColumnExact(['Trans Type']) !== -1 ? findColumnExact(['Trans Type']) : 17,
    businessType: findColumnExact(['Business Type']) !== -1 ? findColumnExact(['Business Type']) : 16,
    bundleType: findColumnExact(['Policy Bundle Type']) !== -1 ? findColumnExact(['Policy Bundle Type']) : 6,
    writtenPremium: findColumnExact(['Written Premium ($)']) !== -1 ? findColumnExact(['Written Premium ($)']) : 7,
    commissionablePremium: findColumnExact(['Commissionable Premium ($)']) !== -1 ? findColumnExact(['Commissionable Premium ($)']) : 9,
    baseRate: findColumnExact(['Base Commission Rate %']) !== -1 ? findColumnExact(['Base Commission Rate %']) : 10,
    baseAmount: findColumnExact(['Base Commission Amount ($)']) !== -1 ? findColumnExact(['Base Commission Amount ($)']) : 11,
    vcRate: findColumnExact(['VC Rate %']) !== -1 ? findColumnExact(['VC Rate %']) : 13,
    vcAmount: findColumnExact(['VC Amount ($) *']) !== -1 ? findColumnExact(['VC Amount ($) *']) : 14,
    // Additional columns for exclusion detection
    channel: headers.findIndex(h => /^channel$/i.test(h.trim())),
    serviceFeeAssignedDate: headers.findIndex(h => /service\s*fee\s*assigned\s*date/i.test(h.trim())),
    origPolicyEffDate: headers.findIndex(h => /orig\.?\s*policy\s*eff\s*date/i.test(h.trim())),
    indicator: headers.findIndex(h => /^indicator$/i.test(h.trim())),
    // Sub-producer tracking
    subProdCode: headers.findIndex(h => /sub[-\s]?prod\s*code/i.test(h.trim())),
  };
  
  // Parse transactions starting after header
  let totalWritten = 0;
  let totalBase = 0;
  let totalVC = 0;
  
  for (let i = headerRowIndex + 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.every(cell => cell === null || cell === '')) continue;
    
    try {
      const policyNumber = String(row[cols.policyNumber] || '').trim();
      if (!policyNumber) continue; // Skip rows without policy number
      
      const writtenPrem = parseNumericValue(row[cols.writtenPremium]);
      const baseAmt = parseNumericValue(row[cols.baseAmount]);
      const vcAmt = parseNumericValue(row[cols.vcAmount]);
      
      const transaction: StatementTransaction = {
        rowNumber: i + 1,
        policyNumber,
        namedInsured: String(row[cols.namedInsured] || ''),
        product: String(row[cols.product] || ''),
        transType: String(row[cols.transType] || ''),
        businessType: String(row[cols.businessType] || ''),
        policyBundleType: String(row[cols.bundleType] || ''),
        writtenPremium: writtenPrem,
        commissionablePremium: parseNumericValue(row[cols.commissionablePremium]),
        baseCommissionRate: parseRateValue(row[cols.baseRate]),
        baseCommissionAmount: baseAmt,
        vcRate: parseRateValue(row[cols.vcRate]),
        vcAmount: vcAmt,
        totalCommission: baseAmt + vcAmt,
        effectiveRate: writtenPrem !== 0 ? (baseAmt + vcAmt) / writtenPrem : 0,
        // Additional fields for exclusion detection
        channel: cols.channel >= 0 ? String(row[cols.channel] || '').trim() : '',
        serviceFeeAssignedDate: cols.serviceFeeAssignedDate >= 0 ? String(row[cols.serviceFeeAssignedDate] || '').trim() : '',
        origPolicyEffDate: cols.origPolicyEffDate >= 0 ? String(row[cols.origPolicyEffDate] || '').trim() : '',
        indicator: cols.indicator >= 0 ? String(row[cols.indicator] || '').trim() : '',
        // Sub-producer tracking
        subProdCode: cols.subProdCode >= 0 ? String(row[cols.subProdCode] || '').trim() : '',
      };
      
      transactions.push(transaction);
      totalWritten += writtenPrem;
      totalBase += baseAmt;
      totalVC += vcAmt;
    } catch (e) {
      errors.push(`Row ${i + 1}: Parse error - ${e instanceof Error ? e.message : 'Unknown'}`);
    }
  }
  
  const totals = {
    writtenPremium: totalWritten,
    baseCommission: totalBase,
    variableComp: totalVC,
    totalCommission: totalBase + totalVC,
  };

  // Debug logging
  console.log('=== PARSING DEBUG ===');
  console.log('Agent Number extracted:', agentNumber);
  console.log('Headers found:', headers);
  console.log('Column mapping:', cols);
  console.log('Sub Prod Code column index:', cols.subProdCode);
  if (cols.subProdCode >= 0) {
    console.log('Sub Prod Code header:', headers[cols.subProdCode]);
  } else {
    console.log('⚠️ Sub Prod Code column NOT FOUND! Looking for pattern /sub[-\\s]?prod\\s*code/i');
    console.log('Available headers:', headers.map((h, i) => `${i}: "${h}"`));
  }
  console.log('Total transactions parsed:', transactions.length);
  console.log('First 3 transactions:', JSON.stringify(transactions.slice(0, 3), null, 2));
  // Check sub-prod codes in transactions
  const uniqueSubProdCodes = [...new Set(transactions.map(t => t.subProdCode))];
  console.log('Unique Sub Prod Codes found:', uniqueSubProdCodes);
  console.log('Totals:', totals);
  console.log('Parse errors:', errors);

  return {
    agentNumber,
    agentName: '',
    transactions,
    totals,
    parseErrors: errors,
  };
}
