import { StatementTransaction } from '../allstate-parser/excel-parser';

export interface SubProducerTransaction {
  policyNumber: string;
  insuredName: string;
  product: string;
  transType: string;
  premium: number;
  commission: number;
  origPolicyEffDate: string;
  isAuto: boolean;
}

export interface SubProducerMetrics {
  code: string;
  displayName: string;
  
  // Premium (first-term only)
  premiumWritten: number;
  premiumChargebacks: number;
  netPremium: number;
  
  // Counts
  policiesIssued: number;
  itemsIssued: number;
  chargebackCount: number;
  
  // Commission (first-term only)
  commissionEarned: number;
  commissionChargebacks: number;
  netCommission: number;
  
  // Rates
  effectiveRate: number;
  
  // Transaction lists for drill-down
  creditTransactions: SubProducerTransaction[];
  chargebackTransactions: SubProducerTransaction[];
}

export interface SubProducerSummary {
  producers: SubProducerMetrics[];
  totals: SubProducerMetrics;
  producerCount: number;
  statementMonth: Date;
  autoCutoffDate: Date;
  homeCutoffDate: Date;
}

// Helper: Parse orig policy eff date (MM/YYYY or MM/DD/YYYY format)
function parseOrigDate(dateStr: string): Date | null {
  try {
    const parts = String(dateStr || '').split('/');
    if (parts.length === 2) {
      // MM/YYYY format
      const month = parseInt(parts[0], 10);
      const year = parseInt(parts[1], 10);
      if (!isNaN(month) && !isNaN(year)) {
        return new Date(year, month - 1, 1);
      }
    } else if (parts.length === 3) {
      // MM/DD/YYYY format
      const month = parseInt(parts[0], 10);
      const year = parseInt(parts[2], 10);
      if (!isNaN(month) && !isNaN(year)) {
        return new Date(year, month - 1, 1);
      }
    }
    return null;
  } catch {
    return null;
  }
}

// Helper: Check if product is Auto (6-month term)
function isAutoProduct(product: string): boolean {
  const productLower = (product || '').toLowerCase();
  return productLower.includes('auto');
}

export function analyzeSubProducers(
  transactions: StatementTransaction[],
  statementMonth?: Date  // Optional - will auto-detect if not provided
): SubProducerSummary {
  
  // Auto-detect statement month from transactions if not provided
  // Use the most recent Policy Eff Date in the data
  let detectedMonth: Date;
  
  if (statementMonth) {
    detectedMonth = statementMonth;
  } else {
    // Find the latest orig policy effective date to determine statement month
    let latestDate = new Date(2000, 0, 1);
    
    for (const tx of transactions) {
      // Use origPolicyEffDate which is available in StatementTransaction
      const origDate = tx.origPolicyEffDate || '';
      if (origDate) {
        try {
          const parts = String(origDate).split('/');
          let parsed: Date | null = null;
          
          if (parts.length === 3) {
            // MM/DD/YYYY format
            parsed = new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
          } else if (parts.length === 2) {
            // MM/YYYY format
            parsed = new Date(parseInt(parts[1]), parseInt(parts[0]) - 1, 1);
          }
          
          if (parsed && !isNaN(parsed.getTime()) && parsed > latestDate) {
            latestDate = parsed;
          }
        } catch {
          // Skip unparseable dates
        }
      }
    }
    
    // Use the month/year of the latest date found
    detectedMonth = new Date(latestDate.getFullYear(), latestDate.getMonth(), 1);
  }
  
  // Calculate cutoff dates based on detected/provided statement month
  // Auto (6-month term): 5 months back
  // Home (12-month term): 11 months back
  const autoCutoffDate = new Date(
    detectedMonth.getFullYear(), 
    detectedMonth.getMonth() - 5, 
    1
  );
  const homeCutoffDate = new Date(
    detectedMonth.getFullYear(), 
    detectedMonth.getMonth() - 11, 
    1
  );
  
  console.log(`[SubProducer] Statement month detected: ${detectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`);
  console.log(`[SubProducer] Auto cutoff (6-mo): ${autoCutoffDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`);
  console.log(`[SubProducer] Home cutoff (12-mo): ${homeCutoffDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`);
  
  // Filter to New Business only
  const nbTransactions = transactions.filter(tx => {
    const businessType = (tx.businessType || '').trim().toLowerCase();
    return businessType === 'new business' || businessType === 'new';
  });
  
  // Helper: Check if transaction is within first term
  function isFirstTerm(tx: StatementTransaction): boolean {
    const origDate = parseOrigDate(tx.origPolicyEffDate || '');
    if (!origDate) return false;
    
    const cutoff = isAutoProduct(tx.product || '') ? autoCutoffDate : homeCutoffDate;
    return origDate >= cutoff;
  }
  
  // Group by Sub-Prod Code
  const producerMap = new Map<string, {
    premiumWritten: number;
    premiumChargebacks: number;
    policiesIssued: number;
    itemsIssued: number;
    chargebackCount: number;
    commissionEarned: number;
    commissionChargebacks: number;
    creditTransactions: SubProducerTransaction[];
    chargebackTransactions: SubProducerTransaction[];
  }>();
  
  for (const tx of nbTransactions) {
    // Skip if not first-term
    if (!isFirstTerm(tx)) continue;
    
    const code = String(tx.subProdCode || '').trim();
    // Handle NaN, undefined, empty as "Agency"
    const normalizedCode = (!code || code === 'NaN' || code === 'undefined') ? '' : code;
    
    if (!producerMap.has(normalizedCode)) {
      producerMap.set(normalizedCode, {
        premiumWritten: 0,
        premiumChargebacks: 0,
        policiesIssued: 0,
        itemsIssued: 0,
        chargebackCount: 0,
        commissionEarned: 0,
        commissionChargebacks: 0,
        creditTransactions: [],
        chargebackTransactions: []
      });
    }
    
    const data = producerMap.get(normalizedCode)!;
    const premium = tx.writtenPremium || 0;
    const baseComm = tx.baseCommissionAmount || 0;
    const vcComm = tx.vcAmount || 0;
    const commission = tx.totalCommission || (baseComm + vcComm);
    const transType = (tx.transType || '').toLowerCase();
    
    // Build transaction record for drill-down
    const txRecord: SubProducerTransaction = {
      policyNumber: tx.policyNumber || '',
      insuredName: tx.namedInsured || '',
      product: tx.product || '',
      transType: tx.transType || '',
      premium: premium,
      commission: commission,
      origPolicyEffDate: tx.origPolicyEffDate || '',
      isAuto: isAutoProduct(tx.product || '')
    };
    
    // Classify transaction
    const isPolicyIssued = transType.includes('policies issued');
    const isCoverageIssued = transType.includes('coverage issued');
    
    if (premium >= 0) {
      // Positive premium = written/credit
      data.premiumWritten += premium;
      data.commissionEarned += commission;
      data.creditTransactions.push(txRecord);
      
      if (isPolicyIssued) data.policiesIssued += 1;
      if (isCoverageIssued) data.itemsIssued += 1;
    } else {
      // Negative premium = chargeback
      data.premiumChargebacks += Math.abs(premium);
      data.commissionChargebacks += Math.abs(commission);
      data.chargebackCount += 1;
      data.chargebackTransactions.push(txRecord);
    }
  }
  
  // Convert to array and calculate derived metrics
  const producers: SubProducerMetrics[] = [];
  
  for (const [code, data] of producerMap) {
    const netPremium = data.premiumWritten - data.premiumChargebacks;
    const netCommission = data.commissionEarned - data.commissionChargebacks;
    
    producers.push({
      code,
      displayName: code === '' ? 'Agency' : `Sub-Producer: ${code}`,
      premiumWritten: data.premiumWritten,
      premiumChargebacks: data.premiumChargebacks,
      netPremium,
      policiesIssued: data.policiesIssued,
      itemsIssued: data.itemsIssued,
      chargebackCount: data.chargebackCount,
      commissionEarned: data.commissionEarned,
      commissionChargebacks: data.commissionChargebacks,
      netCommission,
      effectiveRate: netPremium !== 0 ? (netCommission / netPremium) * 100 : 0,
      creditTransactions: data.creditTransactions,
      chargebackTransactions: data.chargebackTransactions
    });
  }
  
  // Sort: Agency (blank) first, then by code ascending
  producers.sort((a, b) => {
    if (a.code === '' && b.code !== '') return -1;
    if (a.code !== '' && b.code === '') return 1;
    return a.code.localeCompare(b.code, undefined, { numeric: true });
  });
  
  // Calculate totals
  const allCreditTx: SubProducerTransaction[] = [];
  const allChargebackTx: SubProducerTransaction[] = [];
  producers.forEach(p => {
    allCreditTx.push(...p.creditTransactions);
    allChargebackTx.push(...p.chargebackTransactions);
  });
  
  const totals: SubProducerMetrics = {
    code: 'TOTAL',
    displayName: 'All Producers',
    premiumWritten: producers.reduce((sum, p) => sum + p.premiumWritten, 0),
    premiumChargebacks: producers.reduce((sum, p) => sum + p.premiumChargebacks, 0),
    netPremium: producers.reduce((sum, p) => sum + p.netPremium, 0),
    policiesIssued: producers.reduce((sum, p) => sum + p.policiesIssued, 0),
    itemsIssued: producers.reduce((sum, p) => sum + p.itemsIssued, 0),
    chargebackCount: producers.reduce((sum, p) => sum + p.chargebackCount, 0),
    commissionEarned: producers.reduce((sum, p) => sum + p.commissionEarned, 0),
    commissionChargebacks: producers.reduce((sum, p) => sum + p.commissionChargebacks, 0),
    netCommission: producers.reduce((sum, p) => sum + p.netCommission, 0),
    effectiveRate: 0,
    creditTransactions: allCreditTx,
    chargebackTransactions: allChargebackTx
  };
  
  totals.effectiveRate = totals.netPremium !== 0 
    ? (totals.netCommission / totals.netPremium) * 100 
    : 0;
  
  return {
    producers,
    totals,
    producerCount: producers.length,
    statementMonth: detectedMonth,
    autoCutoffDate,
    homeCutoffDate
  };
}
