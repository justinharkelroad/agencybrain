import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMemo } from 'react';
import { startOfMonth, endOfMonth, format, subDays, startOfQuarter, startOfYear } from 'date-fns';

export interface LeadSourceRoiRow {
  leadSourceId: string | null;
  leadSourceName: string;
  spendCents: number;
  totalLeads: number;
  totalQuotes: number;
  totalSales: number;
  premiumCents: number;
  commissionEarned: number; // Premium × commission rate
  roi: number | null; // commission / spend (null if spend = 0)
  costPerSale: number | null; // spend / sales (null if 0 sales)
  // Enhanced fields for Phase 1
  bucketId: string | null;
  bucketName: string | null;
  quotedPolicies: number; // Count of quote rows (1 row = 1 policy)
  quotedItems: number; // Sum of items_quoted
  writtenPolicies: number; // Sum of policies_sold
  writtenItems: number; // Sum of items_sold
  // Cost per Quoted metrics
  costPerQuotedHousehold: number | null;
  costPerQuotedPolicy: number | null;
  costPerQuotedItem: number | null;
  // Acquisition Cost metrics
  householdAcqCost: number | null;
  policyAcqCost: number | null;
  itemAcqCost: number | null;
  // Ratio metrics
  closeRatio: number | null; // Written HH / Quoted HH
  bundleRatio: number | null; // % of written HH with 2+ products
}

export interface LqsRoiSummary {
  // Pipeline view (All Time)
  openLeads: number; // status = 'lead' only
  quotedHouseholds: number; // status = 'quoted' only
  soldHouseholds: number; // status = 'sold'
  // Activity view (Date Filtered)
  leadsReceived: number; // leads where lead_received_date is in range
  quotesCreated: number; // unique households with quote in range
  salesClosed: number; // unique households with sale in range
  // Common
  premiumSoldCents: number;
  commissionEarned: number; // Premium × commission rate
  quoteRate: number | null; // (quoted / leads) * 100 - null when date filtered
  closeRate: number | null; // (sold / quoted) * 100 - null when date filtered
  totalSpendCents: number;
  overallRoi: number | null; // commission / spend (null if spend = 0)
  commissionRate: number; // The commission rate used for calculations
  // Legacy fields for backward compatibility
  totalLeads: number;
  totalQuoted: number;
  totalSold: number;
  // Mode indicator
  isActivityView: boolean;
  // Enhanced summary metrics for Phase 1
  totalQuotedPolicies: number;
  totalQuotedItems: number;
  totalWrittenPolicies: number;
  totalWrittenItems: number;
  bundleRatio: number | null;
}

export interface LqsRoiAnalytics {
  summary: LqsRoiSummary;
  byLeadSource: LeadSourceRoiRow[];
}

export type DateRangePreset = 'last30' | 'last60' | 'last90' | 'quarter' | 'ytd' | 'all';

export function getDateRangeFromPreset(preset: DateRangePreset): { start: Date; end: Date } | null {
  const now = new Date();
  
  switch (preset) {
    case 'last30':
      return { start: subDays(now, 30), end: now };
    case 'last60':
      return { start: subDays(now, 60), end: now };
    case 'last90':
      return { start: subDays(now, 90), end: now };
    case 'quarter':
      return { start: startOfQuarter(now), end: now };
    case 'ytd':
      return { start: startOfYear(now), end: now };
    case 'all':
    default:
      return null;
  }
}

// Household row for pipeline view
interface HouseholdRow {
  id: string;
  status: string | null;
  lead_source_id: string | null;
  created_at: string;
  lead_received_date: string | null;
  sales: Array<{
    sale_date: string | null;
    premium_cents: number | null;
    policies_sold: number | null;
    items_sold: number | null;
    product_type: string | null;
  }> | null;
  quotes: Array<{
    items_quoted: number | null;
    product_type: string | null;
  }> | null;
}

// Quote row for activity view
interface QuoteRow {
  household_id: string;
  quote_date: string | null;
  premium_cents: number | null;
  items_quoted: number | null;
  product_type: string | null;
  household: { lead_source_id: string | null } | null;
}

// Sale row for activity view
interface SaleRow {
  household_id: string;
  sale_date: string | null;
  premium_cents: number | null;
  policies_sold: number | null;
  items_sold: number | null;
  product_type: string | null;
  household: { lead_source_id: string | null } | null;
}

// Lead row for activity view
interface LeadRow {
  id: string;
  lead_source_id: string | null;
  lead_received_date: string | null;
  created_at: string;
}

// Lead source with bucket info
interface LeadSourceWithBucket {
  id: string;
  name: string;
  bucket_id: string | null;
}

// Marketing bucket
interface MarketingBucket {
  id: string;
  name: string;
}

const PAGE_SIZE = 1000;
const MAX_FETCH = 20000;

export function useLqsRoiAnalytics(
  agencyId: string | null,
  dateRange: { start: Date; end: Date } | null
) {
  const isActivityView = dateRange !== null;

  // Fetch agency settings for commission rate
  const agencyQuery = useQuery({
    queryKey: ['agency-commission-rate', agencyId],
    enabled: !!agencyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agencies')
        .select('default_commission_rate')
        .eq('id', agencyId!)
        .single();
      
      if (error) throw error;
      return data;
    },
  });

  // PIPELINE VIEW: Fetch all households (for All Time)
  const householdsQuery = useQuery({
    queryKey: ['lqs-roi-households-pipeline', agencyId],
    enabled: !!agencyId && !isActivityView,
    queryFn: async (): Promise<HouseholdRow[]> => {
      const allRows: HouseholdRow[] = [];

      for (let from = 0; from < MAX_FETCH; from += PAGE_SIZE) {
        const { data: page, error } = await supabase
          .from('lqs_households')
          .select(`
            id,
            status,
            lead_source_id,
            created_at,
            lead_received_date,
            sales:lqs_sales(sale_date, premium_cents, policies_sold, items_sold, product_type),
            quotes:lqs_quotes(items_quoted, product_type)
          `)
          .eq('agency_id', agencyId!)
          .range(from, from + PAGE_SIZE - 1);

        if (error) throw error;
        if (!page || page.length === 0) break;

        allRows.push(...(page as HouseholdRow[]));
        if (page.length < PAGE_SIZE) break;
      }

      return allRows;
    },
  });

  // ACTIVITY VIEW: Fetch leads received in date range
  const leadsReceivedQuery = useQuery({
    queryKey: ['lqs-roi-leads-activity', agencyId, dateRange?.start?.toISOString(), dateRange?.end?.toISOString()],
    enabled: !!agencyId && isActivityView,
    queryFn: async (): Promise<LeadRow[]> => {
      if (!dateRange) return [];
      
      const allRows: LeadRow[] = [];
      const startStr = format(dateRange.start, 'yyyy-MM-dd');
      const endStr = format(dateRange.end, 'yyyy-MM-dd');
      
      for (let from = 0; from < MAX_FETCH; from += PAGE_SIZE) {
        // Fetch all households and filter in memory for complex date logic
        const { data: page, error } = await supabase
          .from('lqs_households')
          .select('id, lead_source_id, lead_received_date, created_at')
          .eq('agency_id', agencyId!)
          .range(from, from + PAGE_SIZE - 1);

        if (error) throw error;
        if (!page || page.length === 0) break;

        // Filter in memory for precise date logic (lead_received_date or created_at fallback)
        const filtered = page.filter(h => {
          const dateToUse = h.lead_received_date || h.created_at;
          if (!dateToUse) return false;
          const d = new Date(dateToUse);
          return d >= dateRange.start && d <= dateRange.end;
        });

        allRows.push(...(filtered as LeadRow[]));
        if (page.length < PAGE_SIZE) break;
      }
      
      return allRows;
    },
  });

  // ACTIVITY VIEW: Fetch quotes created in date range
  const quotesCreatedQuery = useQuery({
    queryKey: ['lqs-roi-quotes-activity', agencyId, dateRange?.start?.toISOString(), dateRange?.end?.toISOString()],
    enabled: !!agencyId && isActivityView,
    queryFn: async (): Promise<QuoteRow[]> => {
      if (!dateRange) return [];

      const allRows: QuoteRow[] = [];
      const startStr = format(dateRange.start, 'yyyy-MM-dd');
      const endStr = format(dateRange.end, 'yyyy-MM-dd');

      for (let from = 0; from < MAX_FETCH; from += PAGE_SIZE) {
        const { data: page, error } = await supabase
          .from('lqs_quotes')
          .select('household_id, quote_date, premium_cents, items_quoted, product_type, household:lqs_households(lead_source_id)')
          .eq('agency_id', agencyId!)
          .gte('quote_date', startStr)
          .lte('quote_date', endStr)
          .range(from, from + PAGE_SIZE - 1);

        if (error) throw error;
        if (!page || page.length === 0) break;

        allRows.push(...(page as QuoteRow[]));
        if (page.length < PAGE_SIZE) break;
      }

      return allRows;
    },
  });

  // ACTIVITY VIEW: Fetch sales closed in date range
  const salesClosedQuery = useQuery({
    queryKey: ['lqs-roi-sales-activity', agencyId, dateRange?.start?.toISOString(), dateRange?.end?.toISOString()],
    enabled: !!agencyId && isActivityView,
    queryFn: async (): Promise<SaleRow[]> => {
      if (!dateRange) return [];

      const allRows: SaleRow[] = [];
      const startStr = format(dateRange.start, 'yyyy-MM-dd');
      const endStr = format(dateRange.end, 'yyyy-MM-dd');

      for (let from = 0; from < MAX_FETCH; from += PAGE_SIZE) {
        const { data: page, error } = await supabase
          .from('lqs_sales')
          .select('household_id, sale_date, premium_cents, policies_sold, items_sold, product_type, household:lqs_households(lead_source_id)')
          .eq('agency_id', agencyId!)
          .gte('sale_date', startStr)
          .lte('sale_date', endStr)
          .range(from, from + PAGE_SIZE - 1);

        if (error) throw error;
        if (!page || page.length === 0) break;

        allRows.push(...(page as SaleRow[]));
        if (page.length < PAGE_SIZE) break;
      }

      return allRows;
    },
  });

  // Fetch lead sources with bucket info
  const leadSourcesQuery = useQuery({
    queryKey: ['lqs-roi-lead-sources', agencyId],
    enabled: !!agencyId,
    queryFn: async (): Promise<LeadSourceWithBucket[]> => {
      const { data, error } = await supabase
        .from('lead_sources')
        .select('id, name, bucket_id')
        .eq('agency_id', agencyId!);

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch marketing buckets
  const bucketsQuery = useQuery({
    queryKey: ['lqs-roi-buckets', agencyId],
    enabled: !!agencyId,
    queryFn: async (): Promise<MarketingBucket[]> => {
      const { data, error } = await supabase
        .from('marketing_buckets')
        .select('id, name')
        .eq('agency_id', agencyId!)
        .order('order_index', { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch spend data from lead_source_monthly_spend
  const spendQuery = useQuery({
    queryKey: ['lqs-roi-spend', agencyId, dateRange?.start?.toISOString(), dateRange?.end?.toISOString()],
    enabled: !!agencyId,
    queryFn: async () => {
      let query = supabase
        .from('lead_source_monthly_spend')
        .select('lead_source_id, total_spend_cents, month')
        .eq('agency_id', agencyId!);
      
      if (dateRange) {
        const startMonth = format(startOfMonth(dateRange.start), 'yyyy-MM-dd');
        const endMonth = format(endOfMonth(dateRange.end), 'yyyy-MM-dd');
        query = query
          .gte('month', startMonth)
          .lte('month', endMonth);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Aggregate analytics
  const analytics = useMemo<LqsRoiAnalytics | null>(() => {
    const leadSources = leadSourcesQuery.data;
    const buckets = bucketsQuery.data || [];
    const spendData = spendQuery.data || [];

    // Get commission rate from agency settings, default to 22%
    const commissionRate = agencyQuery.data?.default_commission_rate ?? 22;

    if (!leadSources) return null;

    // Create lead source maps (name and bucket)
    const leadSourceMap = new Map(leadSources.map(ls => [ls.id, ls.name]));
    const leadSourceBucketMap = new Map(leadSources.map(ls => [ls.id, ls.bucket_id]));

    // Create bucket name map
    const bucketNameMap = new Map(buckets.map(b => [b.id, b.name]));

    // Aggregate spend by lead source
    const spendBySource = new Map<string | null, number>();
    spendData.forEach(s => {
      const current = spendBySource.get(s.lead_source_id) || 0;
      spendBySource.set(s.lead_source_id, current + (s.total_spend_cents || 0));
    });

    const totalSpendCents = Array.from(spendBySource.values()).reduce((sum, val) => sum + val, 0);

    // =============== PIPELINE VIEW (All Time) ===============
    if (!isActivityView) {
      const allHouseholds = householdsQuery.data;
      if (!allHouseholds) return null;

      // Calculate pipeline metrics by current status
      const openLeads = allHouseholds.filter(h => h.status === 'lead').length;
      const quotedHouseholdsCount = allHouseholds.filter(h => h.status === 'quoted').length;
      const soldHouseholdsCount = allHouseholds.filter(h => h.status === 'sold').length;

      // Legacy total counts for funnel calculations
      const totalLeads = allHouseholds.length;
      const totalQuoted = allHouseholds.filter(h => h.status === 'quoted' || h.status === 'sold').length;
      const totalSold = soldHouseholdsCount;

      // Calculate totals for policies/items
      let totalQuotedPolicies = 0;
      let totalQuotedItems = 0;
      let totalWrittenPolicies = 0;
      let totalWrittenItems = 0;

      const premiumSoldCents = allHouseholds.reduce((sum, h) => {
        const householdPremium = (h.sales || []).reduce((s, sale) => s + (sale.premium_cents || 0), 0);
        return sum + householdPremium;
      }, 0);

      const commissionEarned = premiumSoldCents * (commissionRate / 100);
      const quoteRate = totalLeads > 0 ? (totalQuoted / totalLeads) * 100 : 0;
      const closeRate = totalQuoted > 0 ? (totalSold / totalQuoted) * 100 : 0;
      const overallRoi = totalSpendCents > 0 ? commissionEarned / totalSpendCents : null;

      // Enhanced metrics structure per source
      interface SourceMetrics {
        leads: number;
        quotedHouseholds: number;
        soldHouseholds: number;
        premiumCents: number;
        quotedPolicies: number;
        quotedItems: number;
        writtenPolicies: number;
        writtenItems: number;
        // For bundle ratio calculation
        soldHouseholdIds: Set<string>;
        productTypesPerHousehold: Map<string, Set<string>>;
      }

      const bySourceMap = new Map<string | null, SourceMetrics>();

      // Helper to get or create source metrics
      const getSourceMetrics = (sourceId: string | null): SourceMetrics => {
        if (!bySourceMap.has(sourceId)) {
          bySourceMap.set(sourceId, {
            leads: 0,
            quotedHouseholds: 0,
            soldHouseholds: 0,
            premiumCents: 0,
            quotedPolicies: 0,
            quotedItems: 0,
            writtenPolicies: 0,
            writtenItems: 0,
            soldHouseholdIds: new Set(),
            productTypesPerHousehold: new Map(),
          });
        }
        return bySourceMap.get(sourceId)!;
      };

      allHouseholds.forEach(h => {
        const sourceId = h.lead_source_id;
        const metrics = getSourceMetrics(sourceId);

        metrics.leads++;

        // Count quoted households and aggregate quote data
        if (h.status === 'quoted' || h.status === 'sold') {
          metrics.quotedHouseholds++;
        }

        // Aggregate quote data (policies = count of quotes, items = sum of items_quoted)
        const quotes = h.quotes || [];
        metrics.quotedPolicies += quotes.length;
        metrics.quotedItems += quotes.reduce((sum, q) => sum + (q.items_quoted || 1), 0);
        totalQuotedPolicies += quotes.length;
        totalQuotedItems += quotes.reduce((sum, q) => sum + (q.items_quoted || 1), 0);

        // Handle sold households
        if (h.status === 'sold') {
          metrics.soldHouseholds++;
          metrics.soldHouseholdIds.add(h.id);

          const sales = h.sales || [];
          metrics.premiumCents += sales.reduce((sum, sale) => sum + (sale.premium_cents || 0), 0);
          metrics.writtenPolicies += sales.reduce((sum, sale) => sum + (sale.policies_sold || 1), 0);
          metrics.writtenItems += sales.reduce((sum, sale) => sum + (sale.items_sold || 1), 0);
          totalWrittenPolicies += sales.reduce((sum, sale) => sum + (sale.policies_sold || 1), 0);
          totalWrittenItems += sales.reduce((sum, sale) => sum + (sale.items_sold || 1), 0);

          // Track product types for bundle ratio
          if (!metrics.productTypesPerHousehold.has(h.id)) {
            metrics.productTypesPerHousehold.set(h.id, new Set());
          }
          sales.forEach(sale => {
            if (sale.product_type) {
              metrics.productTypesPerHousehold.get(h.id)!.add(sale.product_type);
            }
          });
        }
      });

      // Calculate overall bundle ratio
      let bundledHouseholds = 0;
      let totalSoldHouseholds = 0;
      bySourceMap.forEach(metrics => {
        metrics.productTypesPerHousehold.forEach((productTypes) => {
          totalSoldHouseholds++;
          if (productTypes.size >= 2) {
            bundledHouseholds++;
          }
        });
      });
      const overallBundleRatio = totalSoldHouseholds > 0 ? (bundledHouseholds / totalSoldHouseholds) * 100 : null;

      // Build lead source ROI rows
      const byLeadSource: LeadSourceRoiRow[] = Array.from(bySourceMap.entries()).map(([sourceId, metrics]) => {
        const spendCents = spendBySource.get(sourceId) || 0;
        const sourceCommissionEarned = metrics.premiumCents * (commissionRate / 100);
        const roi = spendCents > 0 ? sourceCommissionEarned / spendCents : null;
        const costPerSale = metrics.soldHouseholds > 0 ? spendCents / metrics.soldHouseholds : null;
        const sourceName = sourceId
          ? (leadSourceMap.get(sourceId) || 'Unknown')
          : 'Unattributed';
        const bucketId = sourceId ? (leadSourceBucketMap.get(sourceId) || null) : null;
        const bucketName = bucketId ? (bucketNameMap.get(bucketId) || null) : null;

        // Calculate cost metrics
        const costPerQuotedHousehold = metrics.quotedHouseholds > 0 ? spendCents / metrics.quotedHouseholds : null;
        const costPerQuotedPolicy = metrics.quotedPolicies > 0 ? spendCents / metrics.quotedPolicies : null;
        const costPerQuotedItem = metrics.quotedItems > 0 ? spendCents / metrics.quotedItems : null;
        const householdAcqCost = metrics.soldHouseholds > 0 ? spendCents / metrics.soldHouseholds : null;
        const policyAcqCost = metrics.writtenPolicies > 0 ? spendCents / metrics.writtenPolicies : null;
        const itemAcqCost = metrics.writtenItems > 0 ? spendCents / metrics.writtenItems : null;

        // Calculate ratios
        const closeRatio = metrics.quotedHouseholds > 0 ? (metrics.soldHouseholds / metrics.quotedHouseholds) * 100 : null;

        // Calculate bundle ratio for this source
        let sourceBundledHouseholds = 0;
        metrics.productTypesPerHousehold.forEach((productTypes) => {
          if (productTypes.size >= 2) {
            sourceBundledHouseholds++;
          }
        });
        const bundleRatio = metrics.soldHouseholds > 0 ? (sourceBundledHouseholds / metrics.soldHouseholds) * 100 : null;

        return {
          leadSourceId: sourceId,
          leadSourceName: sourceName as string,
          spendCents,
          totalLeads: metrics.leads,
          totalQuotes: metrics.quotedHouseholds,
          totalSales: metrics.soldHouseholds,
          premiumCents: metrics.premiumCents,
          commissionEarned: sourceCommissionEarned,
          roi,
          costPerSale,
          // Enhanced fields
          bucketId,
          bucketName,
          quotedPolicies: metrics.quotedPolicies,
          quotedItems: metrics.quotedItems,
          writtenPolicies: metrics.writtenPolicies,
          writtenItems: metrics.writtenItems,
          costPerQuotedHousehold,
          costPerQuotedPolicy,
          costPerQuotedItem,
          householdAcqCost,
          policyAcqCost,
          itemAcqCost,
          closeRatio,
          bundleRatio,
        };
      }).sort((a, b) => b.premiumCents - a.premiumCents);

      const summary: LqsRoiSummary = {
        openLeads,
        quotedHouseholds: quotedHouseholdsCount,
        soldHouseholds: soldHouseholdsCount,
        leadsReceived: 0, // Not applicable in pipeline view
        quotesCreated: 0,
        salesClosed: 0,
        premiumSoldCents,
        commissionEarned,
        quoteRate,
        closeRate,
        totalSpendCents,
        overallRoi,
        commissionRate,
        totalLeads,
        totalQuoted,
        totalSold,
        isActivityView: false,
        // Enhanced summary metrics
        totalQuotedPolicies,
        totalQuotedItems,
        totalWrittenPolicies,
        totalWrittenItems,
        bundleRatio: overallBundleRatio,
      };

      return { summary, byLeadSource };
    }

    // =============== ACTIVITY VIEW (Date Filtered) ===============
    const leadsReceived = leadsReceivedQuery.data;
    const quotesCreated = quotesCreatedQuery.data;
    const salesClosed = salesClosedQuery.data;

    if (!leadsReceived || !quotesCreated || !salesClosed) return null;

    // Count unique households with quotes in period
    const uniqueQuotedHouseholds = new Set(quotesCreated.map(q => q.household_id));

    // Count unique households with sales in period
    const uniqueSoldHouseholds = new Set(salesClosed.map(s => s.household_id));

    // Sum premium from sales in period
    const premiumSoldCents = salesClosed.reduce((sum, s) => sum + (s.premium_cents || 0), 0);

    const commissionEarned = premiumSoldCents * (commissionRate / 100);
    const overallRoi = totalSpendCents > 0 ? commissionEarned / totalSpendCents : null;

    // Calculate totals for policies/items in activity view
    let totalQuotedPolicies = quotesCreated.length; // Each quote row = 1 policy
    let totalQuotedItems = quotesCreated.reduce((sum, q) => sum + (q.items_quoted || 1), 0);
    let totalWrittenPolicies = salesClosed.reduce((sum, s) => sum + (s.policies_sold || 1), 0);
    let totalWrittenItems = salesClosed.reduce((sum, s) => sum + (s.items_sold || 1), 0);

    // Enhanced metrics structure per source for activity view
    interface ActivitySourceMetrics {
      leads: number;
      quotedHouseholdIds: Set<string>;
      soldHouseholdIds: Set<string>;
      premiumCents: number;
      quotedPolicies: number;
      quotedItems: number;
      writtenPolicies: number;
      writtenItems: number;
      productTypesPerHousehold: Map<string, Set<string>>;
    }

    const bySourceMap = new Map<string | null, ActivitySourceMetrics>();

    // Helper to get or create source metrics
    const getSourceMetrics = (sourceId: string | null): ActivitySourceMetrics => {
      if (!bySourceMap.has(sourceId)) {
        bySourceMap.set(sourceId, {
          leads: 0,
          quotedHouseholdIds: new Set(),
          soldHouseholdIds: new Set(),
          premiumCents: 0,
          quotedPolicies: 0,
          quotedItems: 0,
          writtenPolicies: 0,
          writtenItems: 0,
          productTypesPerHousehold: new Map(),
        });
      }
      return bySourceMap.get(sourceId)!;
    };

    // Count leads received by source
    leadsReceived.forEach(l => {
      const sourceId = l.lead_source_id;
      const metrics = getSourceMetrics(sourceId);
      metrics.leads++;
    });

    // Aggregate quote data by source
    quotesCreated.forEach(q => {
      const sourceId = q.household?.lead_source_id ?? null;
      const metrics = getSourceMetrics(sourceId);
      metrics.quotedHouseholdIds.add(q.household_id);
      metrics.quotedPolicies++;
      metrics.quotedItems += q.items_quoted || 1;
    });

    // Aggregate sales data by source
    salesClosed.forEach(s => {
      const sourceId = s.household?.lead_source_id ?? null;
      const metrics = getSourceMetrics(sourceId);
      metrics.soldHouseholdIds.add(s.household_id);
      metrics.premiumCents += s.premium_cents || 0;
      metrics.writtenPolicies += s.policies_sold || 1;
      metrics.writtenItems += s.items_sold || 1;

      // Track product types for bundle ratio
      if (!metrics.productTypesPerHousehold.has(s.household_id)) {
        metrics.productTypesPerHousehold.set(s.household_id, new Set());
      }
      if (s.product_type) {
        metrics.productTypesPerHousehold.get(s.household_id)!.add(s.product_type);
      }
    });

    // Calculate overall bundle ratio for activity view
    let bundledHouseholds = 0;
    let totalSoldHouseholdsForBundle = 0;
    bySourceMap.forEach(metrics => {
      metrics.productTypesPerHousehold.forEach((productTypes) => {
        totalSoldHouseholdsForBundle++;
        if (productTypes.size >= 2) {
          bundledHouseholds++;
        }
      });
    });
    const overallBundleRatio = totalSoldHouseholdsForBundle > 0 ? (bundledHouseholds / totalSoldHouseholdsForBundle) * 100 : null;

    // Build lead source ROI rows
    const byLeadSource: LeadSourceRoiRow[] = Array.from(bySourceMap.entries()).map(([sourceId, metrics]) => {
      const spendCents = spendBySource.get(sourceId) || 0;
      const sourceCommissionEarned = metrics.premiumCents * (commissionRate / 100);
      const roi = spendCents > 0 ? sourceCommissionEarned / spendCents : null;
      const quotedHouseholds = metrics.quotedHouseholdIds.size;
      const soldHouseholds = metrics.soldHouseholdIds.size;
      const costPerSale = soldHouseholds > 0 ? spendCents / soldHouseholds : null;
      const sourceName = sourceId
        ? (leadSourceMap.get(sourceId) || 'Unknown')
        : 'Unattributed';
      const bucketId = sourceId ? (leadSourceBucketMap.get(sourceId) || null) : null;
      const bucketName = bucketId ? (bucketNameMap.get(bucketId) || null) : null;

      // Calculate cost metrics
      const costPerQuotedHousehold = quotedHouseholds > 0 ? spendCents / quotedHouseholds : null;
      const costPerQuotedPolicy = metrics.quotedPolicies > 0 ? spendCents / metrics.quotedPolicies : null;
      const costPerQuotedItem = metrics.quotedItems > 0 ? spendCents / metrics.quotedItems : null;
      const householdAcqCost = soldHouseholds > 0 ? spendCents / soldHouseholds : null;
      const policyAcqCost = metrics.writtenPolicies > 0 ? spendCents / metrics.writtenPolicies : null;
      const itemAcqCost = metrics.writtenItems > 0 ? spendCents / metrics.writtenItems : null;

      // Calculate ratios
      const closeRatio = quotedHouseholds > 0 ? (soldHouseholds / quotedHouseholds) * 100 : null;

      // Calculate bundle ratio for this source
      let sourceBundledHouseholds = 0;
      metrics.productTypesPerHousehold.forEach((productTypes) => {
        if (productTypes.size >= 2) {
          sourceBundledHouseholds++;
        }
      });
      const bundleRatio = soldHouseholds > 0 ? (sourceBundledHouseholds / soldHouseholds) * 100 : null;

      return {
        leadSourceId: sourceId,
        leadSourceName: sourceName as string,
        spendCents,
        totalLeads: metrics.leads,
        totalQuotes: quotedHouseholds,
        totalSales: soldHouseholds,
        premiumCents: metrics.premiumCents,
        commissionEarned: sourceCommissionEarned,
        roi,
        costPerSale,
        // Enhanced fields
        bucketId,
        bucketName,
        quotedPolicies: metrics.quotedPolicies,
        quotedItems: metrics.quotedItems,
        writtenPolicies: metrics.writtenPolicies,
        writtenItems: metrics.writtenItems,
        costPerQuotedHousehold,
        costPerQuotedPolicy,
        costPerQuotedItem,
        householdAcqCost,
        policyAcqCost,
        itemAcqCost,
        closeRatio,
        bundleRatio,
      };
    }).sort((a, b) => b.premiumCents - a.premiumCents);

    // Calculate close rate for activity view: Sales Closed ÷ Quotes Created
    const activityCloseRate = uniqueQuotedHouseholds.size > 0
      ? (uniqueSoldHouseholds.size / uniqueQuotedHouseholds.size) * 100
      : null;

    const summary: LqsRoiSummary = {
      openLeads: 0, // Not applicable in activity view
      quotedHouseholds: 0,
      soldHouseholds: 0,
      leadsReceived: leadsReceived.length,
      quotesCreated: uniqueQuotedHouseholds.size,
      salesClosed: uniqueSoldHouseholds.size,
      premiumSoldCents,
      commissionEarned,
      quoteRate: null, // Not applicable in activity view - hide the card
      closeRate: activityCloseRate, // Sales Closed ÷ Quotes Created
      totalSpendCents,
      overallRoi,
      commissionRate,
      totalLeads: leadsReceived.length,
      totalQuoted: uniqueQuotedHouseholds.size,
      totalSold: uniqueSoldHouseholds.size,
      isActivityView: true,
      // Enhanced summary metrics
      totalQuotedPolicies,
      totalQuotedItems,
      totalWrittenPolicies,
      totalWrittenItems,
      bundleRatio: overallBundleRatio,
    };

    return { summary, byLeadSource };
  }, [
    isActivityView,
    householdsQuery.data,
    leadsReceivedQuery.data,
    quotesCreatedQuery.data,
    salesClosedQuery.data,
    leadSourcesQuery.data,
    bucketsQuery.data,
    spendQuery.data,
    agencyQuery.data,
  ]);

  const isLoading = isActivityView
    ? leadsReceivedQuery.isLoading || quotesCreatedQuery.isLoading || salesClosedQuery.isLoading || leadSourcesQuery.isLoading || bucketsQuery.isLoading || spendQuery.isLoading || agencyQuery.isLoading
    : householdsQuery.isLoading || leadSourcesQuery.isLoading || bucketsQuery.isLoading || spendQuery.isLoading || agencyQuery.isLoading;

  const queryError = isActivityView
    ? leadsReceivedQuery.error || quotesCreatedQuery.error || salesClosedQuery.error || leadSourcesQuery.error || bucketsQuery.error || spendQuery.error || agencyQuery.error
    : householdsQuery.error || leadSourcesQuery.error || bucketsQuery.error || spendQuery.error || agencyQuery.error;

  return {
    data: analytics,
    isLoading,
    error: queryError,
    refetch: () => {
      if (isActivityView) {
        leadsReceivedQuery.refetch();
        quotesCreatedQuery.refetch();
        salesClosedQuery.refetch();
      } else {
        householdsQuery.refetch();
      }
      leadSourcesQuery.refetch();
      bucketsQuery.refetch();
      spendQuery.refetch();
      agencyQuery.refetch();
    },
  };
}
