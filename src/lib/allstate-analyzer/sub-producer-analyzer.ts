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
  bundleType: string; // 'Monoline', 'Standard', 'Preferred', or raw value from statement
}

// Aggregated insured record (net per insured)
export interface InsuredAggregate {
  insuredName: string;
  netPremium: number;
  netCommission: number;
  transactionCount: number;
}

// Breakdown of metrics by bundle type for compensation calculation
export interface BundleTypeBreakdown {
  bundleType: string; // 'monoline', 'standard', 'preferred'
  premiumWritten: number;
  premiumChargebacks: number;
  netPremium: number;
  itemsIssued: number;
  creditCount: number;
  chargebackCount: number;
}

// Breakdown of metrics by product for compensation calculation
export interface ProductBreakdown {
  product: string;
  premiumWritten: number;
  premiumChargebacks: number;
  netPremium: number;
  itemsIssued: number;
  creditCount: number;
  chargebackCount: number;
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

  // Breakdowns for advanced compensation calculation
  byBundleType: BundleTypeBreakdown[];
  byProduct: ProductBreakdown[];
}

export interface SubProducerSummary {
  producers: SubProducerMetrics[];
  totals: SubProducerMetrics;
  producerCount: number;
  statementMonth: Date;
  autoCutoffDate: Date;
  homeCutoffDate: Date;
}

// Team member type for display name lookup
export interface TeamMemberForLookup {
  id: string;
  name: string;
  sub_producer_code: string | null;
}

// Helper function to get producer display name from team members
export function getProducerDisplayName(
  code: string, 
  teamMembers: TeamMemberForLookup[] = []
): string {
  if (!code || code === '') return 'Agency';
  
  // Normalize code for comparison (trim whitespace, convert to string)
  const normalizedCode = String(code).trim();
  
  // Find team member with matching sub_producer_code
  const member = teamMembers.find(tm => {
    const tmCode = String(tm.sub_producer_code || '').trim();
    return tmCode === normalizedCode;
  });
  
  if (member) {
    return member.name;
  }
  
  return `Sub-Producer: ${code}`;
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

// Helper: Normalize bundle type to standard values
// Returns 'monoline', 'standard', 'preferred', or the original value lowercased
function normalizeBundleType(bundleType: string): string {
  const normalized = (bundleType || '').trim().toLowerCase();

  // Map common variations to standard values
  if (!normalized || normalized === 'mono' || normalized === 'monoline' || normalized === 'mono line') {
    return 'monoline';
  }
  if (normalized === 'standard' || normalized === 'std' || normalized === 'standard bundle') {
    return 'standard';
  }
  if (normalized === 'preferred' || normalized === 'pref' || normalized === 'preferred bundle') {
    return 'preferred';
  }

  // Return as-is if not recognized (lowercased)
  return normalized || 'monoline'; // Default to monoline if empty
}

// Helper: Normalize product name for grouping
function normalizeProductName(product: string): string {
  const normalized = (product || '').trim().toLowerCase();

  // Normalize common product names
  if (normalized.includes('auto') || normalized.includes('alpac')) {
    return 'Auto';
  }
  if (normalized.includes('home') && !normalized.includes('homeowner')) {
    return 'Home';
  }
  if (normalized.includes('homeowner')) {
    return 'Homeowners';
  }
  if (normalized.includes('condo')) {
    return 'Condo';
  }
  if (normalized.includes('renter')) {
    return 'Renters';
  }
  if (normalized.includes('umbrella')) {
    return 'Umbrella';
  }
  if (normalized.includes('landlord') || normalized.includes('dwelling')) {
    return 'Landlord/Dwelling';
  }

  // Return original with title case if not recognized
  return product.trim() || 'Other';
}

// Helper: Calculate breakdown by bundle type from transactions
function calculateBundleTypeBreakdown(
  creditTransactions: SubProducerTransaction[],
  chargebackTransactions: SubProducerTransaction[]
): BundleTypeBreakdown[] {
  const bundleMap = new Map<string, BundleTypeBreakdown>();

  // Initialize standard bundle types
  ['monoline', 'standard', 'preferred'].forEach(bt => {
    bundleMap.set(bt, {
      bundleType: bt,
      premiumWritten: 0,
      premiumChargebacks: 0,
      netPremium: 0,
      itemsIssued: 0,
      creditCount: 0,
      chargebackCount: 0
    });
  });

  // Process credit transactions
  for (const tx of creditTransactions) {
    const bt = tx.bundleType || 'monoline';
    if (!bundleMap.has(bt)) {
      bundleMap.set(bt, {
        bundleType: bt,
        premiumWritten: 0,
        premiumChargebacks: 0,
        netPremium: 0,
        itemsIssued: 0,
        creditCount: 0,
        chargebackCount: 0
      });
    }
    const breakdown = bundleMap.get(bt)!;
    breakdown.premiumWritten += tx.premium;
    breakdown.itemsIssued += 1;
    breakdown.creditCount += 1;
  }

  // Process chargeback transactions
  for (const tx of chargebackTransactions) {
    const bt = tx.bundleType || 'monoline';
    if (!bundleMap.has(bt)) {
      bundleMap.set(bt, {
        bundleType: bt,
        premiumWritten: 0,
        premiumChargebacks: 0,
        netPremium: 0,
        itemsIssued: 0,
        creditCount: 0,
        chargebackCount: 0
      });
    }
    const breakdown = bundleMap.get(bt)!;
    breakdown.premiumChargebacks += Math.abs(tx.premium);
    breakdown.chargebackCount += 1;
  }

  // Calculate net premium for each bundle type
  for (const breakdown of bundleMap.values()) {
    breakdown.netPremium = breakdown.premiumWritten - breakdown.premiumChargebacks;
  }

  // Return only bundle types with activity
  return Array.from(bundleMap.values()).filter(b =>
    b.premiumWritten > 0 || b.premiumChargebacks > 0
  );
}

// Helper: Calculate breakdown by product from transactions
function calculateProductBreakdown(
  creditTransactions: SubProducerTransaction[],
  chargebackTransactions: SubProducerTransaction[]
): ProductBreakdown[] {
  const productMap = new Map<string, ProductBreakdown>();

  // Process credit transactions
  for (const tx of creditTransactions) {
    const product = normalizeProductName(tx.product);
    if (!productMap.has(product)) {
      productMap.set(product, {
        product,
        premiumWritten: 0,
        premiumChargebacks: 0,
        netPremium: 0,
        itemsIssued: 0,
        creditCount: 0,
        chargebackCount: 0
      });
    }
    const breakdown = productMap.get(product)!;
    breakdown.premiumWritten += tx.premium;
    breakdown.itemsIssued += 1;
    breakdown.creditCount += 1;
  }

  // Process chargeback transactions
  for (const tx of chargebackTransactions) {
    const product = normalizeProductName(tx.product);
    if (!productMap.has(product)) {
      productMap.set(product, {
        product,
        premiumWritten: 0,
        premiumChargebacks: 0,
        netPremium: 0,
        itemsIssued: 0,
        creditCount: 0,
        chargebackCount: 0
      });
    }
    const breakdown = productMap.get(product)!;
    breakdown.premiumChargebacks += Math.abs(tx.premium);
    breakdown.chargebackCount += 1;
  }

  // Calculate net premium for each product
  for (const breakdown of productMap.values()) {
    breakdown.netPremium = breakdown.premiumWritten - breakdown.premiumChargebacks;
  }

  // Return only products with activity, sorted by premium descending
  return Array.from(productMap.values())
    .filter(p => p.premiumWritten > 0 || p.premiumChargebacks > 0)
    .sort((a, b) => b.premiumWritten - a.premiumWritten);
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
  
  // Debug: Check all business types and negative premium transactions
  const allBusinessTypes = [...new Set(transactions.map(tx => tx.businessType))];
  console.log(`[SubProducer] All business types in file:`, allBusinessTypes);

  const allNegativePremium = transactions.filter(tx => tx.writtenPremium < 0);
  console.log(`[SubProducer] Total negative premium transactions (ALL): ${allNegativePremium.length}`);
  if (allNegativePremium.length > 0) {
    console.log(`[SubProducer] Sample ALL negative transactions:`, allNegativePremium.slice(0, 5).map(tx => ({
      subProdCode: tx.subProdCode,
      businessType: tx.businessType,
      premium: tx.writtenPremium,
      insured: tx.namedInsured?.substring(0, 20),
    })));

    // Check specifically for code 850
    const code850Negative = allNegativePremium.filter(tx => String(tx.subProdCode || '').trim() === '850');
    console.log(`[SubProducer] Code 850 negative premium transactions: ${code850Negative.length}`);
    if (code850Negative.length > 0) {
      console.log(`[SubProducer] Code 850 chargebacks:`, code850Negative.map(tx => ({
        businessType: tx.businessType,
        premium: tx.writtenPremium,
        insured: tx.namedInsured?.substring(0, 20),
        origDate: tx.origPolicyEffDate,
      })));
    }
  }

  // Filter to first-term transactions:
  // 1. businessType = "New Business" (explicit first-term)
  // 2. transType contains "First Term" but NOT "First Renewal Term"
  // 3. Chargebacks (negative premium) - filtered later by businessType
  const nbTransactions = transactions.filter(tx => {
    const businessType = (tx.businessType || '').trim().toLowerCase();
    const transType = (tx.transType || '').trim().toLowerCase();
    const isNewBusiness = businessType === 'new business' || businessType === 'new';
    // "First Term" but not "First Renewal Term"
    const isFirstTermTrans = transType.includes('first term') && !transType.includes('first renewal');
    const isChargeback = (tx.writtenPremium || 0) < 0;
    return isNewBusiness || isFirstTermTrans || isChargeback;
  });

  console.log(`[SubProducer] After first-term filter: ${nbTransactions.length} of ${transactions.length} transactions`);
  
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
  
  // Debug: Log a sample of transactions to see subProdCode values
  console.log(`[SubProducer] Sample transactions subProdCode values:`, nbTransactions.slice(0, 5).map(tx => ({
    subProdCode: tx.subProdCode,
    subProdCodeLen: tx.subProdCode?.length,
    insured: tx.namedInsured?.substring(0, 20),
    premium: tx.writtenPremium,
  })));

  // Check specifically for transactions with negative premium (chargebacks)
  const negativeTransactions = nbTransactions.filter(tx => tx.writtenPremium < 0);
  console.log(`[SubProducer] Found ${negativeTransactions.length} transactions with negative premium`);
  if (negativeTransactions.length > 0) {
    console.log(`[SubProducer] Sample CHARGEBACK transactions:`, negativeTransactions.slice(0, 5).map(tx => ({
      subProdCode: tx.subProdCode,
      subProdCodeLen: tx.subProdCode?.length,
      insured: tx.namedInsured?.substring(0, 20),
      premium: tx.writtenPremium,
      transType: tx.transType,
    })));
  }

  // Filter by first-term rule:
  // Include if: businessType = "New Business" OR transType contains "First Term" (not "First Renewal")
  // Exclude if: businessType contains "Renewal"
  let firstTermSkipped = 0;
  let firstTermKept = 0;

  for (const tx of nbTransactions) {
    const isChargeback = (tx.writtenPremium || 0) < 0;
    const businessType = (tx.businessType || '').trim().toLowerCase();
    const transType = (tx.transType || '').trim().toLowerCase();
    const isFirstTermByType = businessType === 'new business' || businessType === 'new';
    // "First Term" but NOT "First Renewal Term"
    const isFirstTermByTrans = transType.includes('first term') && !transType.includes('first renewal');
    const isRenewal = businessType.includes('renewal');

    // Always keep negative rows as chargeback candidates; rule logic decides eligibility later.
    if (!isChargeback) {
      // Skip if it's a renewal (unless explicitly marked as first-term, which "First Renewal" is not)
      if (isRenewal && !isFirstTermByTrans) {
        firstTermSkipped++;
        continue;
      }
      if (!isFirstTermByType && !isFirstTermByTrans && !isFirstTerm(tx)) {
        firstTermSkipped++;
        continue;
      }
    }
    firstTermKept++;

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
      isAuto: isAutoProduct(tx.product || ''),
      bundleType: normalizeBundleType(tx.policyBundleType || '')
    });
  }
  
  // Debug: Log first-term filter results (credits only; chargebacks pass through)
  console.log(`[SubProducer] First-term filter: kept ${firstTermKept}, skipped ${firstTermSkipped} (credits only, chargebacks pass through to payout calculator)`);

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

    // Debug: Log code 850's insured map
    if (code === '850') {
      console.log(`[SubProducer] Code 850 insured map has ${insuredMap.size} insureds`);
      let negativeNetCount = 0;
      for (const [name, d] of insuredMap) {
        if (d.netPremium < 0) {
          negativeNetCount++;
          console.log(`[SubProducer] Code 850 NEGATIVE net insured: "${name}" = $${d.netPremium.toFixed(2)}`);
        }
      }
      console.log(`[SubProducer] Code 850 insureds with negative net: ${negativeNetCount}`);
    }

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

    // Calculate breakdowns by bundle type and product
    const byBundleType = calculateBundleTypeBreakdown(creditTransactions, chargebackTransactions);
    const byProduct = calculateProductBreakdown(creditTransactions, chargebackTransactions);

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
      chargebackTransactions,
      byBundleType,
      byProduct
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
  
  // Calculate total breakdowns
  const totalByBundleType = calculateBundleTypeBreakdown(allCreditTx, allChargebackTx);
  const totalByProduct = calculateProductBreakdown(allCreditTx, allChargebackTx);

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
    chargebackTransactions: allChargebackTx,
    byBundleType: totalByBundleType,
    byProduct: totalByProduct
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
