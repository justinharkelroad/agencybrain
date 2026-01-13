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
  sales: Array<{ sale_date: string | null; premium_cents: number | null }> | null;
}

// Quote row for activity view
interface QuoteRow {
  household_id: string;
  quote_date: string | null;
  premium_cents: number | null;
  household: { lead_source_id: string | null } | null;
}

// Sale row for activity view
interface SaleRow {
  household_id: string;
  sale_date: string | null;
  premium_cents: number | null;
  household: { lead_source_id: string | null } | null;
}

// Lead row for activity view
interface LeadRow {
  id: string;
  lead_source_id: string | null;
  lead_received_date: string | null;
  created_at: string;
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
            sales:lqs_sales(sale_date, premium_cents)
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
        const { data: page, error } = await supabase
          .from('lqs_households')
          .select('id, lead_source_id, lead_received_date, created_at')
          .eq('agency_id', agencyId!)
          .or(`lead_received_date.gte.${startStr},and(lead_received_date.is.null,created_at.gte.${startStr})`)
          .or(`lead_received_date.lte.${endStr},and(lead_received_date.is.null,created_at.lte.${endStr})`)
          .range(from, from + PAGE_SIZE - 1);
        
        if (error) throw error;
        if (!page || page.length === 0) break;
        
        // Filter in memory for precise date logic
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
          .select('household_id, quote_date, premium_cents, household:lqs_households(lead_source_id)')
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
          .select('household_id, sale_date, premium_cents, household:lqs_households(lead_source_id)')
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

  // Fetch lead sources for name mapping
  const leadSourcesQuery = useQuery({
    queryKey: ['lqs-roi-lead-sources', agencyId],
    enabled: !!agencyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_sources')
        .select('id, name')
        .eq('agency_id', agencyId!);
      
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
    const spendData = spendQuery.data || [];
    
    // Get commission rate from agency settings, default to 22%
    const commissionRate = agencyQuery.data?.default_commission_rate ?? 22;
    
    if (!leadSources) return null;

    // Create lead source name map
    const leadSourceMap = new Map(leadSources.map(ls => [ls.id, ls.name]));

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
      const quotedHouseholds = allHouseholds.filter(h => h.status === 'quoted').length;
      const soldHouseholds = allHouseholds.filter(h => h.status === 'sold').length;
      
      // Legacy total counts for funnel calculations
      const totalLeads = allHouseholds.length;
      const totalQuoted = allHouseholds.filter(h => h.status === 'quoted' || h.status === 'sold').length;
      const totalSold = soldHouseholds;
      
      const premiumSoldCents = allHouseholds.reduce((sum, h) => {
        const householdPremium = (h.sales || []).reduce((s, sale) => s + (sale.premium_cents || 0), 0);
        return sum + householdPremium;
      }, 0);

      const commissionEarned = premiumSoldCents * (commissionRate / 100);
      const quoteRate = totalLeads > 0 ? (totalQuoted / totalLeads) * 100 : 0;
      const closeRate = totalQuoted > 0 ? (totalSold / totalQuoted) * 100 : 0;
      const overallRoi = totalSpendCents > 0 ? commissionEarned / totalSpendCents : null;

      // Group by lead source for table
      const bySourceMap = new Map<string | null, {
        leads: number;
        quotes: number;
        sales: number;
        premiumCents: number;
      }>();

      allHouseholds.forEach(h => {
        const sourceId = h.lead_source_id;
        const current = bySourceMap.get(sourceId) || { leads: 0, quotes: 0, sales: 0, premiumCents: 0 };
        
        current.leads++;
        if (h.status === 'quoted' || h.status === 'sold') current.quotes++;
        if (h.status === 'sold') {
          current.sales++;
          current.premiumCents += (h.sales || []).reduce((s, sale) => s + (sale.premium_cents || 0), 0);
        }
        
        bySourceMap.set(sourceId, current);
      });

      // Build lead source ROI rows
      const byLeadSource: LeadSourceRoiRow[] = Array.from(bySourceMap.entries()).map(([sourceId, metrics]) => {
        const spendCents = spendBySource.get(sourceId) || 0;
        const sourceCommissionEarned = metrics.premiumCents * (commissionRate / 100);
        const roi = spendCents > 0 ? sourceCommissionEarned / spendCents : null;
        const costPerSale = metrics.sales > 0 ? spendCents / metrics.sales : null;
        const sourceName = sourceId 
          ? (leadSourceMap.get(sourceId) || 'Unknown') 
          : 'Unattributed';

        return {
          leadSourceId: sourceId,
          leadSourceName: sourceName as string,
          spendCents,
          totalLeads: metrics.leads,
          totalQuotes: metrics.quotes,
          totalSales: metrics.sales,
          premiumCents: metrics.premiumCents,
          commissionEarned: sourceCommissionEarned,
          roi,
          costPerSale,
        };
      }).sort((a, b) => b.premiumCents - a.premiumCents);

      const summary: LqsRoiSummary = {
        openLeads,
        quotedHouseholds,
        soldHouseholds,
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

    // Group by lead source for activity view
    const bySourceMap = new Map<string | null, {
      leads: number;
      quotes: number;
      sales: number;
      premiumCents: number;
    }>();

    // Count leads received by source
    leadsReceived.forEach(l => {
      const sourceId = l.lead_source_id;
      const current = bySourceMap.get(sourceId) || { leads: 0, quotes: 0, sales: 0, premiumCents: 0 };
      current.leads++;
      bySourceMap.set(sourceId, current);
    });

    // Count unique quoted households by source
    const quotedBySource = new Map<string | null, Set<string>>();
    quotesCreated.forEach(q => {
      const sourceId = q.household?.lead_source_id ?? null;
      if (!quotedBySource.has(sourceId)) {
        quotedBySource.set(sourceId, new Set());
      }
      quotedBySource.get(sourceId)!.add(q.household_id);
    });
    quotedBySource.forEach((households, sourceId) => {
      const current = bySourceMap.get(sourceId) || { leads: 0, quotes: 0, sales: 0, premiumCents: 0 };
      current.quotes = households.size;
      bySourceMap.set(sourceId, current);
    });

    // Count unique sold households by source and sum premium
    const soldBySource = new Map<string | null, { households: Set<string>; premium: number }>();
    salesClosed.forEach(s => {
      const sourceId = s.household?.lead_source_id ?? null;
      if (!soldBySource.has(sourceId)) {
        soldBySource.set(sourceId, { households: new Set(), premium: 0 });
      }
      soldBySource.get(sourceId)!.households.add(s.household_id);
      soldBySource.get(sourceId)!.premium += s.premium_cents || 0;
    });
    soldBySource.forEach((data, sourceId) => {
      const current = bySourceMap.get(sourceId) || { leads: 0, quotes: 0, sales: 0, premiumCents: 0 };
      current.sales = data.households.size;
      current.premiumCents = data.premium;
      bySourceMap.set(sourceId, current);
    });

    // Build lead source ROI rows
    const byLeadSource: LeadSourceRoiRow[] = Array.from(bySourceMap.entries()).map(([sourceId, metrics]) => {
      const spendCents = spendBySource.get(sourceId) || 0;
      const sourceCommissionEarned = metrics.premiumCents * (commissionRate / 100);
      const roi = spendCents > 0 ? sourceCommissionEarned / spendCents : null;
      const costPerSale = metrics.sales > 0 ? spendCents / metrics.sales : null;
      const sourceName = sourceId 
        ? (leadSourceMap.get(sourceId) || 'Unknown') 
        : 'Unattributed';

      return {
        leadSourceId: sourceId,
        leadSourceName: sourceName as string,
        spendCents,
        totalLeads: metrics.leads,
        totalQuotes: metrics.quotes,
        totalSales: metrics.sales,
        premiumCents: metrics.premiumCents,
        commissionEarned: sourceCommissionEarned,
        roi,
        costPerSale,
      };
    }).sort((a, b) => b.premiumCents - a.premiumCents);

    const summary: LqsRoiSummary = {
      openLeads: 0, // Not applicable in activity view
      quotedHouseholds: 0,
      soldHouseholds: 0,
      leadsReceived: leadsReceived.length,
      quotesCreated: uniqueQuotedHouseholds.size,
      salesClosed: uniqueSoldHouseholds.size,
      premiumSoldCents,
      commissionEarned,
      quoteRate: null, // Not applicable in activity view
      closeRate: null,
      totalSpendCents,
      overallRoi,
      commissionRate,
      totalLeads: leadsReceived.length,
      totalQuoted: uniqueQuotedHouseholds.size,
      totalSold: uniqueSoldHouseholds.size,
      isActivityView: true,
    };

    return { summary, byLeadSource };
  }, [
    isActivityView,
    householdsQuery.data,
    leadsReceivedQuery.data,
    quotesCreatedQuery.data,
    salesClosedQuery.data,
    leadSourcesQuery.data,
    spendQuery.data,
    agencyQuery.data,
  ]);

  const isLoading = isActivityView
    ? leadsReceivedQuery.isLoading || quotesCreatedQuery.isLoading || salesClosedQuery.isLoading || leadSourcesQuery.isLoading || spendQuery.isLoading || agencyQuery.isLoading
    : householdsQuery.isLoading || leadSourcesQuery.isLoading || spendQuery.isLoading || agencyQuery.isLoading;

  const queryError = isActivityView
    ? leadsReceivedQuery.error || quotesCreatedQuery.error || salesClosedQuery.error || leadSourcesQuery.error || spendQuery.error || agencyQuery.error
    : householdsQuery.error || leadSourcesQuery.error || spendQuery.error || agencyQuery.error;

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
      spendQuery.refetch();
      agencyQuery.refetch();
    },
  };
}
