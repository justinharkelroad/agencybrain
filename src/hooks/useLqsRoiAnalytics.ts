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
  openLeads: number; // status = 'lead' only
  quotedHouseholds: number; // status = 'quoted' only
  soldHouseholds: number; // status = 'sold'
  premiumSoldCents: number;
  commissionEarned: number; // Premium × commission rate
  quoteRate: number; // (quoted / leads) * 100
  closeRate: number; // (sold / quoted) * 100
  totalSpendCents: number;
  overallRoi: number | null; // commission / spend (null if spend = 0)
  commissionRate: number; // The commission rate used for calculations
  // Legacy fields for backward compatibility
  totalLeads: number;
  totalQuoted: number;
  totalSold: number;
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

interface HouseholdRow {
  id: string;
  status: string | null;
  lead_source_id: string | null;
  created_at: string;
  sales: Array<{ premium_cents: number | null }> | null;
}

const PAGE_SIZE = 1000;
const MAX_FETCH = 20000;

export function useLqsRoiAnalytics(
  agencyId: string | null,
  dateRange: { start: Date; end: Date } | null
) {
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

  // Fetch households with sales (paginated to avoid 1000 row limit)
  const householdsQuery = useQuery({
    queryKey: ['lqs-roi-households', agencyId, dateRange?.start?.toISOString(), dateRange?.end?.toISOString()],
    enabled: !!agencyId,
    queryFn: async (): Promise<HouseholdRow[]> => {
      const allRows: HouseholdRow[] = [];
      
      for (let from = 0; from < MAX_FETCH; from += PAGE_SIZE) {
        let query = supabase
          .from('lqs_households')
          .select(`
            id,
            status,
            lead_source_id,
            created_at,
            sales:lqs_sales(premium_cents)
          `)
          .eq('agency_id', agencyId!)
          .range(from, from + PAGE_SIZE - 1);
        
        if (dateRange) {
          query = query
            .gte('created_at', dateRange.start.toISOString())
            .lte('created_at', dateRange.end.toISOString());
        }
        
        const { data: page, error } = await query;
        if (error) throw error;
        if (!page || page.length === 0) break;
        
        allRows.push(...(page as HouseholdRow[]));
        
        // If we got less than PAGE_SIZE, we've reached the end
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
        // Filter by month (first day of month format: yyyy-MM-01)
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
    if (!householdsQuery.data || !leadSourcesQuery.data) return null;

    const households = householdsQuery.data;
    const leadSources = leadSourcesQuery.data;
    const spendData = spendQuery.data || [];
    
    // Get commission rate from agency settings, default to 22%
    const commissionRate = agencyQuery.data?.default_commission_rate ?? 22;

    // Create lead source name map
    const leadSourceMap = new Map(leadSources.map(ls => [ls.id, ls.name]));

    // Aggregate spend by lead source
    const spendBySource = new Map<string | null, number>();
    spendData.forEach(s => {
      const current = spendBySource.get(s.lead_source_id) || 0;
      spendBySource.set(s.lead_source_id, current + (s.total_spend_cents || 0));
    });

    // Calculate summary metrics - FIXED COUNTS
    const openLeads = households.filter(h => h.status === 'lead').length;
    const quotedHouseholds = households.filter(h => h.status === 'quoted').length;
    const soldHouseholds = households.filter(h => h.status === 'sold').length;
    
    // Legacy total counts for funnel calculations
    const totalLeads = households.length;
    const totalQuoted = households.filter(h => h.status === 'quoted' || h.status === 'sold').length;
    const totalSold = soldHouseholds;
    
    const premiumSoldCents = households.reduce((sum, h) => {
      const householdPremium = (h.sales || []).reduce((s, sale) => s + (sale.premium_cents || 0), 0);
      return sum + householdPremium;
    }, 0);

    const totalSpendCents = Array.from(spendBySource.values()).reduce((sum, val) => sum + val, 0);

    // Calculate commission earned using commission rate
    const commissionEarned = premiumSoldCents * (commissionRate / 100);

    const quoteRate = totalLeads > 0 ? (totalQuoted / totalLeads) * 100 : 0;
    const closeRate = totalQuoted > 0 ? (totalSold / totalQuoted) * 100 : 0;
    
    // FIXED ROI: commission / spend (not premium / spend)
    const overallRoi = totalSpendCents > 0 ? commissionEarned / totalSpendCents : null;

    const summary: LqsRoiSummary = {
      openLeads,
      quotedHouseholds,
      soldHouseholds,
      premiumSoldCents,
      commissionEarned,
      quoteRate,
      closeRate,
      totalSpendCents,
      overallRoi,
      commissionRate,
      // Legacy fields
      totalLeads,
      totalQuoted,
      totalSold,
    };

    // Group by lead source
    const bySourceMap = new Map<string | null, {
      leads: number;
      quotes: number;
      sales: number;
      premiumCents: number;
    }>();

    households.forEach(h => {
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
    const byLeadSource: LeadSourceRoiRow[] = [];
    
    const entries = Array.from(bySourceMap.entries());
    for (const [sourceId, metrics] of entries) {
      const spendCents = spendBySource.get(sourceId) || 0;
      const sourceCommissionEarned = metrics.premiumCents * (commissionRate / 100);
      // FIXED ROI: commission / spend (not premium / spend)
      const roi = spendCents > 0 ? sourceCommissionEarned / spendCents : null;
      const costPerSale = metrics.sales > 0 ? spendCents / metrics.sales : null;
      const sourceName = sourceId 
        ? (leadSourceMap.get(sourceId) || 'Unknown') 
        : 'Unattributed';

      byLeadSource.push({
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
      });
    }

    // Sort by premium descending
    byLeadSource.sort((a, b) => b.premiumCents - a.premiumCents);

    return { summary, byLeadSource };
  }, [householdsQuery.data, leadSourcesQuery.data, spendQuery.data, agencyQuery.data]);

  return {
    data: analytics,
    isLoading: householdsQuery.isLoading || leadSourcesQuery.isLoading || spendQuery.isLoading || agencyQuery.isLoading,
    error: householdsQuery.error || leadSourcesQuery.error || spendQuery.error || agencyQuery.error,
    refetch: () => {
      householdsQuery.refetch();
      leadSourcesQuery.refetch();
      spendQuery.refetch();
      agencyQuery.refetch();
    },
  };
}