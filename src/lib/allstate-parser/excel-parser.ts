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

export async function parseCompensationStatement(file: File): Promise<ParsedStatement> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  
  const errors: string[] = [];
  const transactions: StatementTransaction[] = [];
  
  // Convert to JSON array of arrays
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as any[][];
  
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
      agentNumber: '',
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
  
  // Helper to find column by partial match
  const findColumn = (keywords: string[]): number => {
    for (const keyword of keywords) {
      for (const [header, idx] of Object.entries(colIndex)) {
        if (header.toLowerCase().includes(keyword.toLowerCase())) {
          return idx;
        }
      }
    }
    return -1;
  };
  
  // Map columns (with fallback indices if not found)
  const cols = {
    policyNumber: findColumn(['Policy Number', 'Policy#', 'Policy']) ?? 0,
    namedInsured: findColumn(['Named Insured', 'Insured Name', 'Insured']) ?? 1,
    product: findColumn(['Product', 'Line of Business', 'LOB']) ?? 2,
    transType: findColumn(['Trans Type', 'Transaction Type', 'Trans']) ?? 3,
    businessType: findColumn(['Business Type', 'Biz Type', 'New/Renewal']) ?? 4,
    bundleType: findColumn(['Bundle Type', 'Policy Bundle', 'Bundle']) ?? 5,
    writtenPremium: findColumn(['Written Premium', 'Premium']) ?? 7,
    commissionablePremium: findColumn(['Commissionable Premium', 'Comm Premium']) ?? 8,
    baseRate: findColumn(['Base Rate', 'Base %', 'Base Commission Rate']) ?? 10,
    baseAmount: findColumn(['Base Amount', 'Base Commission', 'Base Comm']) ?? 11,
    vcRate: findColumn(['VC Rate', 'Variable Rate', 'Var Comp Rate']) ?? 12,
    vcAmount: findColumn(['VC Amount', 'Variable Comp', 'Var Comp']) ?? 13,
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
  console.log('Headers found:', headers);
  console.log('Column mapping:', cols);
  console.log('Total transactions parsed:', transactions.length);
  console.log('First 3 transactions:', JSON.stringify(transactions.slice(0, 3), null, 2));
  console.log('Totals:', totals);
  console.log('Parse errors:', errors);

  return {
    agentNumber: '',
    agentName: '',
    transactions,
    totals,
    parseErrors: errors,
  };
}
