import { StatementTransaction } from '../allstate-parser/excel-parser';

// Individual transaction record (for reference)
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

// Aggregated insured record (net per insured)
export interface InsuredAggregate {
  insuredName: string;
  netPremium: number;
  netCommission: number;
  transactionCount: number;
}

export interface SubProducerMetrics {
  code: string;
  displayName: string;
  
  // Premium (first-term only) - based on net per insured
  premiumWritten: number;       // Sum of positive insured nets
  premiumChargebacks: number;   // Sum of negative insured nets (as positive value)
  netPremium: number;
  
  // Counts - unique insureds, not transactions
  creditCount: number;          // Insureds with positive net
  chargebackCount: number;      // Insureds with negative net
  
  // Legacy counts for display
  policiesIssued: number;
  itemsIssued: number;
  
  // Commission (first-term only) - based on net per insured
  commissionEarned: number;     // Sum of positive insured net commissions
  commissionChargebacks: number; // Sum of negative insured net commissions (as positive value)
  netCommission: number;
  
  // Rates
  effectiveRate: number;
  
  // Aggregated insured lists for drill-down (net per insured)
  creditInsureds: InsuredAggregate[];      // Insureds with positive net
  chargebackInsureds: InsuredAggregate[];  // Insureds with negative net
  
  // Keep raw transactions for reference if needed
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
// Auto products: contains "auto" or "alpac" (case-insensitive)
function isAutoProduct(product: string): boolean {
  const productLower = (product || '').toLowerCase();
  return productLower.includes('auto') || productLower.includes('alpac');
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
  
  // Step 1: Group by Sub-Prod Code, then by Insured Name
  // Structure: producerCode -> insuredName -> { premium, commission, transactions }
  const producerInsuredMap = new Map<string, Map<string, {
    netPremium: number;
    netCommission: number;
    transactions: SubProducerTransaction[];
    policiesIssued: number;
    itemsIssued: number;
  }>>();
  
  for (const tx of nbTransactions) {
    // Skip if not first-term
    if (!isFirstTerm(tx)) continue;
    
    const code = String(tx.subProdCode || '').trim();
    const normalizedCode = (!code || code === 'NaN' || code === 'undefined') ? '' : code;
    const insuredName = (tx.namedInsured || '').trim();
    
    if (!producerInsuredMap.has(normalizedCode)) {
      producerInsuredMap.set(normalizedCode, new Map());
    }
    
    const insuredMap = producerInsuredMap.get(normalizedCode)!;
    
    if (!insuredMap.has(insuredName)) {
      insuredMap.set(insuredName, {
        netPremium: 0,
        netCommission: 0,
        transactions: [],
        policiesIssued: 0,
        itemsIssued: 0
      });
    }
    
    const data = insuredMap.get(insuredName)!;
    const premium = tx.writtenPremium || 0;
    const baseComm = tx.baseCommissionAmount || 0;
    const vcComm = tx.vcAmount || 0;
    const commission = tx.totalCommission || (baseComm + vcComm);
    const transType = (tx.transType || '').toLowerCase();
    
    // Accumulate net values (positive + negative)
    data.netPremium += premium;
    data.netCommission += commission;
    
    // Track policies/items issued
    if (transType.includes('policies issued')) data.policiesIssued += 1;
    if (transType.includes('coverage issued')) data.itemsIssued += 1;
    
    // Store transaction for reference
    data.transactions.push({
      policyNumber: tx.policyNumber || '',
      insuredName: insuredName,
      product: tx.product || '',
      transType: tx.transType || '',
      premium: premium,
      commission: commission,
      origPolicyEffDate: tx.origPolicyEffDate || '',
      isAuto: isAutoProduct(tx.product || '')
    });
  }
  
  // Step 2: Convert to producer metrics with net-per-insured aggregation
  const producers: SubProducerMetrics[] = [];
  
  for (const [code, insuredMap] of producerInsuredMap) {
    let premiumWritten = 0;       // Sum of positive insured nets
    let premiumChargebacks = 0;   // Sum of negative insured nets
    let commissionEarned = 0;
    let commissionChargebacks = 0;
    let policiesIssued = 0;
    let itemsIssued = 0;
    
    const creditInsureds: InsuredAggregate[] = [];
    const chargebackInsureds: InsuredAggregate[] = [];
    const creditTransactions: SubProducerTransaction[] = [];
    const chargebackTransactions: SubProducerTransaction[] = [];
    
    for (const [insuredName, data] of insuredMap) {
      // Accumulate legacy counts
      policiesIssued += data.policiesIssued;
      itemsIssued += data.itemsIssued;
      
      // Skip insureds with net = 0 (cancelled their own policy)
      if (Math.abs(data.netPremium) < 0.01) continue;
      
      const aggregate: InsuredAggregate = {
        insuredName,
        netPremium: data.netPremium,
        netCommission: data.netCommission,
        transactionCount: data.transactions.length
      };
      
      if (data.netPremium > 0) {
        // Positive net = credit
        premiumWritten += data.netPremium;
        commissionEarned += data.netCommission;
        creditInsureds.push(aggregate);
        creditTransactions.push(...data.transactions);
      } else {
        // Negative net = chargeback
        premiumChargebacks += Math.abs(data.netPremium);
        commissionChargebacks += Math.abs(data.netCommission);
        chargebackInsureds.push(aggregate);
        chargebackTransactions.push(...data.transactions);
      }
    }
    
    // Sort insureds: credits by net descending, chargebacks by net ascending (most negative first)
    creditInsureds.sort((a, b) => b.netPremium - a.netPremium);
    chargebackInsureds.sort((a, b) => a.netPremium - b.netPremium);
    
    const netPremium = premiumWritten - premiumChargebacks;
    const netCommission = commissionEarned - commissionChargebacks;
    
    producers.push({
      code,
      displayName: code === '' ? 'Agency' : `Sub-Producer: ${code}`,
      premiumWritten,
      premiumChargebacks,
      netPremium,
      creditCount: creditInsureds.length,
      chargebackCount: chargebackInsureds.length,
      policiesIssued,
      itemsIssued,
      commissionEarned,
      commissionChargebacks,
      netCommission,
      effectiveRate: netPremium !== 0 ? (netCommission / netPremium) * 100 : 0,
      creditInsureds,
      chargebackInsureds,
      creditTransactions,
      chargebackTransactions
    });
  }
  
  // Sort: Agency (blank) first, then by code ascending
  producers.sort((a, b) => {
    if (a.code === '' && b.code !== '') return -1;
    if (a.code !== '' && b.code === '') return 1;
    return a.code.localeCompare(b.code, undefined, { numeric: true });
  });
  
  // Calculate totals
  const allCreditInsureds: InsuredAggregate[] = [];
  const allChargebackInsureds: InsuredAggregate[] = [];
  const allCreditTx: SubProducerTransaction[] = [];
  const allChargebackTx: SubProducerTransaction[] = [];
  
  producers.forEach(p => {
    allCreditInsureds.push(...p.creditInsureds);
    allChargebackInsureds.push(...p.chargebackInsureds);
    allCreditTx.push(...p.creditTransactions);
    allChargebackTx.push(...p.chargebackTransactions);
  });
  
  // Sort totals
  allCreditInsureds.sort((a, b) => b.netPremium - a.netPremium);
  allChargebackInsureds.sort((a, b) => a.netPremium - b.netPremium);
  
  const totals: SubProducerMetrics = {
    code: 'TOTAL',
    displayName: 'All Producers',
    premiumWritten: producers.reduce((sum, p) => sum + p.premiumWritten, 0),
    premiumChargebacks: producers.reduce((sum, p) => sum + p.premiumChargebacks, 0),
    netPremium: producers.reduce((sum, p) => sum + p.netPremium, 0),
    creditCount: allCreditInsureds.length,
    chargebackCount: allChargebackInsureds.length,
    policiesIssued: producers.reduce((sum, p) => sum + p.policiesIssued, 0),
    itemsIssued: producers.reduce((sum, p) => sum + p.itemsIssued, 0),
    commissionEarned: producers.reduce((sum, p) => sum + p.commissionEarned, 0),
    commissionChargebacks: producers.reduce((sum, p) => sum + p.commissionChargebacks, 0),
    netCommission: producers.reduce((sum, p) => sum + p.netCommission, 0),
    effectiveRate: 0,
    creditInsureds: allCreditInsureds,
    chargebackInsureds: allChargebackInsureds,
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
