import { ParsedStatement, StatementTransaction } from '../allstate-parser/excel-parser';

export interface ProductBreakdown {
  product: string;
  prior: {
    premium: number;
    baseCommission: number;
    variableComp: number;
    totalCommission: number;
    transactionCount: number;
  };
  current: {
    premium: number;
    baseCommission: number;
    variableComp: number;
    totalCommission: number;
    transactionCount: number;
  };
  change: {
    premium: number;
    premiumPercent: number;
    commission: number;
    commissionPercent: number;
  };
}

export interface BusinessTypeBreakdown {
  type: 'New Business' | 'Renewal';
  prior: { premium: number; commission: number; count: number };
  current: { premium: number; commission: number; count: number };
  change: { premium: number; commission: number };
}

export interface ComparisonResult {
  summary: {
    priorTotals: ParsedStatement['totals'];
    currentTotals: ParsedStatement['totals'];
    changes: {
      writtenPremium: number;
      writtenPremiumPercent: number;
      baseCommission: number;
      baseCommissionPercent: number;
      variableComp: number;
      variableCompPercent: number;
      totalCommission: number;
      totalCommissionPercent: number;
    };
  };
  productBreakdown: ProductBreakdown[];
  businessTypeBreakdown: BusinessTypeBreakdown[];
  winners: ProductBreakdown[]; // Top 5 by commission increase
  losers: ProductBreakdown[];  // Top 5 by commission decrease
}

function calculatePercentChange(prior: number, current: number): number {
  if (prior === 0) return current === 0 ? 0 : 100;
  return ((current - prior) / Math.abs(prior)) * 100;
}

function groupByProduct(transactions: StatementTransaction[]): Map<string, {
  premium: number;
  baseCommission: number;
  variableComp: number;
  totalCommission: number;
  count: number;
}> {
  const map = new Map();
  
  for (const tx of transactions) {
    const product = tx.product || 'Unknown';
    const existing = map.get(product) || { premium: 0, baseCommission: 0, variableComp: 0, totalCommission: 0, count: 0 };
    existing.premium += tx.writtenPremium;
    existing.baseCommission += tx.baseCommissionAmount;
    existing.variableComp += tx.vcAmount;
    existing.totalCommission += tx.totalCommission;
    existing.count += 1;
    map.set(product, existing);
  }
  
  return map;
}

function groupByBusinessType(transactions: StatementTransaction[]): Map<string, {
  premium: number;
  commission: number;
  count: number;
}> {
  const map = new Map();
  
  for (const tx of transactions) {
    const bizType = tx.businessType.toLowerCase().includes('new') ? 'New Business' : 'Renewal';
    const existing = map.get(bizType) || { premium: 0, commission: 0, count: 0 };
    existing.premium += tx.writtenPremium;
    existing.commission += tx.totalCommission;
    existing.count += 1;
    map.set(bizType, existing);
  }
  
  return map;
}

export function compareStatements(prior: ParsedStatement, current: ParsedStatement): ComparisonResult {
  // Summary comparison
  const summary = {
    priorTotals: prior.totals,
    currentTotals: current.totals,
    changes: {
      writtenPremium: current.totals.writtenPremium - prior.totals.writtenPremium,
      writtenPremiumPercent: calculatePercentChange(prior.totals.writtenPremium, current.totals.writtenPremium),
      baseCommission: current.totals.baseCommission - prior.totals.baseCommission,
      baseCommissionPercent: calculatePercentChange(prior.totals.baseCommission, current.totals.baseCommission),
      variableComp: current.totals.variableComp - prior.totals.variableComp,
      variableCompPercent: calculatePercentChange(prior.totals.variableComp, current.totals.variableComp),
      totalCommission: current.totals.totalCommission - prior.totals.totalCommission,
      totalCommissionPercent: calculatePercentChange(prior.totals.totalCommission, current.totals.totalCommission),
    },
  };
  
  // Product breakdown
  const priorByProduct = groupByProduct(prior.transactions);
  const currentByProduct = groupByProduct(current.transactions);
  const allProducts = new Set([...priorByProduct.keys(), ...currentByProduct.keys()]);
  
  const productBreakdown: ProductBreakdown[] = [];
  
  for (const product of allProducts) {
    const priorData = priorByProduct.get(product) || { premium: 0, baseCommission: 0, variableComp: 0, totalCommission: 0, count: 0 };
    const currentData = currentByProduct.get(product) || { premium: 0, baseCommission: 0, variableComp: 0, totalCommission: 0, count: 0 };
    
    productBreakdown.push({
      product,
      prior: {
        premium: priorData.premium,
        baseCommission: priorData.baseCommission,
        variableComp: priorData.variableComp,
        totalCommission: priorData.totalCommission,
        transactionCount: priorData.count,
      },
      current: {
        premium: currentData.premium,
        baseCommission: currentData.baseCommission,
        variableComp: currentData.variableComp,
        totalCommission: currentData.totalCommission,
        transactionCount: currentData.count,
      },
      change: {
        premium: currentData.premium - priorData.premium,
        premiumPercent: calculatePercentChange(priorData.premium, currentData.premium),
        commission: currentData.totalCommission - priorData.totalCommission,
        commissionPercent: calculatePercentChange(priorData.totalCommission, currentData.totalCommission),
      },
    });
  }
  
  // Business type breakdown
  const priorByBizType = groupByBusinessType(prior.transactions);
  const currentByBizType = groupByBusinessType(current.transactions);
  
  const businessTypeBreakdown: BusinessTypeBreakdown[] = (['New Business', 'Renewal'] as const).map(type => {
    const priorData = priorByBizType.get(type) || { premium: 0, commission: 0, count: 0 };
    const currentData = currentByBizType.get(type) || { premium: 0, commission: 0, count: 0 };
    
    return {
      type,
      prior: priorData,
      current: currentData,
      change: {
        premium: currentData.premium - priorData.premium,
        commission: currentData.commission - priorData.commission,
      },
    };
  });
  
  // Sort by commission change for winners/losers
  const sorted = [...productBreakdown].sort((a, b) => b.change.commission - a.change.commission);
  const winners = sorted.filter(p => p.change.commission > 0).slice(0, 5);
  const losers = sorted.filter(p => p.change.commission < 0).slice(-5).reverse();
  
  return {
    summary,
    productBreakdown,
    businessTypeBreakdown,
    winners,
    losers,
  };
}
