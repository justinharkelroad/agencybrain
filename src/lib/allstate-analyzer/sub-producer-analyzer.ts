import { StatementTransaction } from '../allstate-parser/excel-parser';

export interface SubProducerMetrics {
  code: string;
  displayName: string;
  
  // Premium
  premiumWritten: number;
  premiumChargebacks: number;
  netPremium: number;
  
  // Counts
  policiesIssued: number;
  itemsIssued: number;
  cancellationCount: number;
  
  // Commission
  commissionEarned: number;
  commissionChargebacks: number;
  netCommission: number;
  
  // Rates
  effectiveRate: number;
}

export interface SubProducerSummary {
  producers: SubProducerMetrics[];
  totals: SubProducerMetrics;
  producerCount: number;
}

export function analyzeSubProducers(
  transactions: StatementTransaction[]
): SubProducerSummary {
  
  // Filter to New Business only
  const nbTransactions = transactions.filter(tx => {
    const businessType = (tx.businessType || '').trim().toLowerCase();
    return businessType === 'new business' || businessType === 'new';
  });
  
  // Group by Sub-Prod Code
  const producerMap = new Map<string, {
    premiumWritten: number;
    premiumChargebacks: number;
    policiesIssued: number;
    itemsIssued: number;
    cancellationCount: number;
    commissionEarned: number;
    commissionChargebacks: number;
  }>();
  
  for (const tx of nbTransactions) {
    const code = (tx.subProdCode || '').toString().trim();
    
    if (!producerMap.has(code)) {
      producerMap.set(code, {
        premiumWritten: 0,
        premiumChargebacks: 0,
        policiesIssued: 0,
        itemsIssued: 0,
        cancellationCount: 0,
        commissionEarned: 0,
        commissionChargebacks: 0
      });
    }
    
    const data = producerMap.get(code)!;
    const premium = tx.writtenPremium || 0;
    const commission = tx.totalCommission || ((tx.baseCommissionAmount || 0) + (tx.vcAmount || 0));
    const transType = (tx.transType || '').toLowerCase();
    
    // Classify transaction
    const isCancellation = transType.includes('cancel');
    const isPolicyIssued = transType.includes('policies issued');
    const isCoverageIssued = transType.includes('coverage issued');
    
    if (premium >= 0) {
      // Positive premium = written
      data.premiumWritten += premium;
      data.commissionEarned += commission;
      
      if (isPolicyIssued) {
        data.policiesIssued += 1;
      }
      if (isCoverageIssued) {
        data.itemsIssued += 1;
      }
    } else {
      // Negative premium = chargeback
      data.premiumChargebacks += Math.abs(premium);
      data.commissionChargebacks += Math.abs(commission);
      
      if (isCancellation || isPolicyIssued || isCoverageIssued) {
        data.cancellationCount += 1;
      }
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
      cancellationCount: data.cancellationCount,
      commissionEarned: data.commissionEarned,
      commissionChargebacks: data.commissionChargebacks,
      netCommission,
      effectiveRate: netPremium !== 0 ? (netCommission / netPremium) * 100 : 0
    });
  }
  
  // Sort: Agency (blank) first, then by code ascending
  producers.sort((a, b) => {
    if (a.code === '' && b.code !== '') return -1;
    if (a.code !== '' && b.code === '') return 1;
    return a.code.localeCompare(b.code, undefined, { numeric: true });
  });
  
  // Calculate totals
  const totals: SubProducerMetrics = {
    code: 'TOTAL',
    displayName: 'All Producers',
    premiumWritten: producers.reduce((sum, p) => sum + p.premiumWritten, 0),
    premiumChargebacks: producers.reduce((sum, p) => sum + p.premiumChargebacks, 0),
    netPremium: producers.reduce((sum, p) => sum + p.netPremium, 0),
    policiesIssued: producers.reduce((sum, p) => sum + p.policiesIssued, 0),
    itemsIssued: producers.reduce((sum, p) => sum + p.itemsIssued, 0),
    cancellationCount: producers.reduce((sum, p) => sum + p.cancellationCount, 0),
    commissionEarned: producers.reduce((sum, p) => sum + p.commissionEarned, 0),
    commissionChargebacks: producers.reduce((sum, p) => sum + p.commissionChargebacks, 0),
    netCommission: producers.reduce((sum, p) => sum + p.netCommission, 0),
    effectiveRate: 0
  };
  
  totals.effectiveRate = totals.netPremium !== 0 
    ? (totals.netCommission / totals.netPremium) * 100 
    : 0;
  
  // Console logging for debugging
  console.log('\n👥 SUB-PRODUCER BREAKDOWN (New Business):');
  console.log(`Total Producers: ${producers.length}`);
  console.log(`Total NB Premium Written: $${totals.premiumWritten.toFixed(2)}`);
  console.log(`Total Chargebacks: $${totals.premiumChargebacks.toFixed(2)}`);
  console.log(`Total Net Commission: $${totals.netCommission.toFixed(2)}`);
  console.log('---');
  producers.forEach(p => {
    console.log(`${p.displayName}:`);
    console.log(`  Premium: $${p.premiumWritten.toFixed(2)} written, -$${p.premiumChargebacks.toFixed(2)} chargebacks = $${p.netPremium.toFixed(2)} net`);
    console.log(`  Activity: ${p.policiesIssued} policies, ${p.itemsIssued} items, ${p.cancellationCount} cancels`);
    console.log(`  Commission: $${p.netCommission.toFixed(2)} net (${p.effectiveRate.toFixed(1)}%)`);
  });
  
  return {
    producers,
    totals,
    producerCount: producers.length
  };
}
