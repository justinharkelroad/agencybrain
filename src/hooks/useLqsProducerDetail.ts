import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMemo } from 'react';
import { format, startOfWeek, startOfMonth, differenceInDays } from 'date-fns';

export type ProducerViewMode = 'quotedBy' | 'soldBy';

export interface ProducerHouseholdRow {
  id: string;
  firstName: string;
  lastName: string;
  status: string | null;
  leadReceivedDate: string | null;
  leadSourceName: string | null;
  // Aggregated from quotes
  quotedPolicies: number;
  quotedItems: number;
  quotedPremiumCents: number;
  // Aggregated from sales
  soldPolicies: number;
  soldItems: number;
  soldPremiumCents: number;
  // Quote details
  quotes: Array<{
    quoteDate: string;
    productType: string;
    itemsQuoted: number;
    premiumCents: number;
    teamMemberName: string | null;
  }>;
  // Sale details
  sales: Array<{
    saleDate: string;
    productType: string;
    itemsSold: number;
    policiesSold: number;
    premiumCents: number;
    teamMemberName: string | null;
  }>;
}

export interface LeadSourceBreakdown {
  leadSourceId: string | null;
  leadSourceName: string;
  totalHouseholds: number;
  quotedHouseholds: number;
  soldHouseholds: number;
  premiumCents: number;
  closeRatio: number | null;
}

export interface ProductTypeBreakdown {
  productType: string;
  quotedCount: number;
  soldCount: number;
  quotedPremiumCents: number;
  soldPremiumCents: number;
  closeRatio: number | null;
}

export interface TrendDataPoint {
  periodLabel: string;
  periodKey: string;
  quotedHouseholds: number;
  soldHouseholds: number;
  premiumCents: number;
}

export interface ProducerDetailData {
  teamMemberId: string | null;
  teamMemberName: string;
  viewMode: ProducerViewMode;
  summary: {
    totalHouseholds: number;
    quotedHouseholds: number;
    soldHouseholds: number;
    closeRatio: number | null;
    quotedPremiumCents: number;
    soldPremiumCents: number;
  };
  byLeadSource: LeadSourceBreakdown[];
  byProductType: ProductTypeBreakdown[];
  trendData: TrendDataPoint[];
  households: ProducerHouseholdRow[];
}

const PAGE_SIZE = 500;
const MAX_FETCH = 5000;

export function useLqsProducerDetail(
  agencyId: string | null,
  teamMemberId: string | null | undefined,
  viewMode: ProducerViewMode,
  dateRange: { start: Date; end: Date } | null,
  enabled: boolean = true
) {
  // Only run query when explicitly enabled and teamMemberId is provided (including null for unassigned)
  const isEnabled = enabled && !!agencyId && teamMemberId !== undefined;

  // Fetch team members for name lookup
  const teamMembersQuery = useQuery({
    queryKey: ['lqs-producer-detail-team-members', agencyId],
    enabled: isEnabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('id, name')
        .eq('agency_id', agencyId!);

      if (error) throw error;
      return new Map((data || []).map(tm => [tm.id, tm.name]));
    },
  });

  // Fetch lead sources for name lookup
  const leadSourcesQuery = useQuery({
    queryKey: ['lqs-producer-detail-lead-sources', agencyId],
    enabled: isEnabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_sources')
        .select('id, name')
        .eq('agency_id', agencyId!);

      if (error) throw error;
      return new Map((data || []).map(ls => [ls.id, ls.name]));
    },
  });

  // Fetch households based on view mode
  // For "quotedBy" - fetch households that have quotes by this team member
  // For "soldBy" - fetch households that have sales by this team member
  const householdsQuery = useQuery({
    queryKey: ['lqs-producer-detail-households', agencyId, teamMemberId, viewMode, dateRange?.start?.toISOString(), dateRange?.end?.toISOString()],
    enabled: isEnabled,
    queryFn: async () => {
      // First, get the household IDs that match our criteria
      let householdIds: string[] = [];

      if (viewMode === 'quotedBy') {
        // Get households where this team member created quotes
        let query = supabase
          .from('lqs_quotes')
          .select('household_id')
          .eq('agency_id', agencyId!);

        if (teamMemberId === null) {
          query = query.is('team_member_id', null);
        } else {
          query = query.eq('team_member_id', teamMemberId);
        }

        if (dateRange) {
          const startStr = format(dateRange.start, 'yyyy-MM-dd');
          const endStr = format(dateRange.end, 'yyyy-MM-dd');
          query = query.gte('quote_date', startStr).lte('quote_date', endStr);
        }

        const { data, error } = await query;
        if (error) throw error;
        householdIds = [...new Set((data || []).map(q => q.household_id))];
      } else {
        // Get households where this team member closed sales
        let query = supabase
          .from('lqs_sales')
          .select('household_id')
          .eq('agency_id', agencyId!);

        if (teamMemberId === null) {
          query = query.is('team_member_id', null);
        } else {
          query = query.eq('team_member_id', teamMemberId);
        }

        if (dateRange) {
          const startStr = format(dateRange.start, 'yyyy-MM-dd');
          const endStr = format(dateRange.end, 'yyyy-MM-dd');
          query = query.gte('sale_date', startStr).lte('sale_date', endStr);
        }

        const { data, error } = await query;
        if (error) throw error;
        householdIds = [...new Set((data || []).map(s => s.household_id))];
      }

      if (householdIds.length === 0) {
        return [];
      }

      // Now fetch the full household data for these IDs
      const allRows: any[] = [];
      const batchSize = 50; // Supabase IN query limit

      for (let i = 0; i < householdIds.length && allRows.length < MAX_FETCH; i += batchSize) {
        const batch = householdIds.slice(i, i + batchSize);
        const { data, error } = await supabase
          .from('lqs_households')
          .select(`
            id,
            first_name,
            last_name,
            status,
            lead_received_date,
            lead_source_id,
            quotes:lqs_quotes(
              quote_date,
              product_type,
              items_quoted,
              premium_cents,
              team_member_id
            ),
            sales:lqs_sales(
              sale_date,
              product_type,
              items_sold,
              policies_sold,
              premium_cents,
              team_member_id
            )
          `)
          .eq('agency_id', agencyId!)
          .in('id', batch);

        if (error) throw error;
        if (data) {
          allRows.push(...data);
        }
      }

      return allRows;
    },
  });

  // Process data
  const data = useMemo<ProducerDetailData | null>(() => {
    const teamMemberMap = teamMembersQuery.data;
    const leadSourceMap = leadSourcesQuery.data;
    const householdsRaw = householdsQuery.data;

    if (!teamMemberMap || !leadSourceMap || !householdsRaw) return null;

    const teamMemberName = teamMemberId === null
      ? 'Unassigned'
      : (teamMemberMap.get(teamMemberId) || 'Unknown');

    // Process households
    const households: ProducerHouseholdRow[] = householdsRaw.map((h: any) => {
      const quotes = (h.quotes || []).map((q: any) => ({
        quoteDate: q.quote_date,
        productType: q.product_type,
        itemsQuoted: q.items_quoted || 1,
        premiumCents: q.premium_cents || 0,
        teamMemberName: q.team_member_id ? (teamMemberMap.get(q.team_member_id) || 'Unknown') : null,
      }));

      const sales = (h.sales || []).map((s: any) => ({
        saleDate: s.sale_date,
        productType: s.product_type,
        itemsSold: s.items_sold || 1,
        policiesSold: s.policies_sold || 1,
        premiumCents: s.premium_cents || 0,
        teamMemberName: s.team_member_id ? (teamMemberMap.get(s.team_member_id) || 'Unknown') : null,
      }));

      // Aggregate metrics
      const quotedPolicies = quotes.length;
      const quotedItems = quotes.reduce((sum: number, q: any) => sum + q.itemsQuoted, 0);
      const quotedPremiumCents = quotes.reduce((sum: number, q: any) => sum + q.premiumCents, 0);

      const soldPolicies = sales.reduce((sum: number, s: any) => sum + s.policiesSold, 0);
      const soldItems = sales.reduce((sum: number, s: any) => sum + s.itemsSold, 0);
      const soldPremiumCents = sales.reduce((sum: number, s: any) => sum + s.premiumCents, 0);

      return {
        id: h.id,
        firstName: h.first_name,
        lastName: h.last_name,
        status: h.status,
        leadReceivedDate: h.lead_received_date,
        leadSourceName: h.lead_source_id ? (leadSourceMap.get(h.lead_source_id) || 'Unknown') : 'Unattributed',
        quotedPolicies,
        quotedItems,
        quotedPremiumCents,
        soldPolicies,
        soldItems,
        soldPremiumCents,
        quotes,
        sales,
      };
    });

    // Calculate summary
    const quotedHouseholds = households.filter(h => h.quotedPolicies > 0).length;
    const soldHouseholds = households.filter(h => h.soldPolicies > 0).length;
    const totalQuotedPremiumCents = households.reduce((sum, h) => sum + h.quotedPremiumCents, 0);
    const totalSoldPremiumCents = households.reduce((sum, h) => sum + h.soldPremiumCents, 0);
    const closeRatio = quotedHouseholds > 0 ? (soldHouseholds / quotedHouseholds) * 100 : null;

    // Calculate by lead source
    const leadSourceMap2 = new Map<string | null, {
      totalHouseholds: Set<string>;
      quotedHouseholds: Set<string>;
      soldHouseholds: Set<string>;
      premiumCents: number;
      leadSourceName: string;
    }>();

    households.forEach(h => {
      const lsId = householdsRaw.find((raw: any) => raw.id === h.id)?.lead_source_id || null;
      const lsName = h.leadSourceName;

      if (!leadSourceMap2.has(lsId)) {
        leadSourceMap2.set(lsId, {
          totalHouseholds: new Set(),
          quotedHouseholds: new Set(),
          soldHouseholds: new Set(),
          premiumCents: 0,
          leadSourceName: lsName,
        });
      }

      const entry = leadSourceMap2.get(lsId)!;
      entry.totalHouseholds.add(h.id);
      if (h.quotedPolicies > 0) entry.quotedHouseholds.add(h.id);
      if (h.soldPolicies > 0) {
        entry.soldHouseholds.add(h.id);
        entry.premiumCents += h.soldPremiumCents;
      }
    });

    const byLeadSource: LeadSourceBreakdown[] = Array.from(leadSourceMap2.entries())
      .map(([lsId, entry]) => ({
        leadSourceId: lsId,
        leadSourceName: entry.leadSourceName,
        totalHouseholds: entry.totalHouseholds.size,
        quotedHouseholds: entry.quotedHouseholds.size,
        soldHouseholds: entry.soldHouseholds.size,
        premiumCents: entry.premiumCents,
        closeRatio: entry.quotedHouseholds.size > 0
          ? (entry.soldHouseholds.size / entry.quotedHouseholds.size) * 100
          : null,
      }))
      .sort((a, b) => b.premiumCents - a.premiumCents);

    // Calculate by product type
    const productTypeMap = new Map<string, {
      quotedCount: number;
      soldCount: number;
      quotedPremiumCents: number;
      soldPremiumCents: number;
    }>();

    households.forEach(h => {
      h.quotes.forEach(q => {
        const pt = q.productType || 'Other';
        if (!productTypeMap.has(pt)) {
          productTypeMap.set(pt, {
            quotedCount: 0,
            soldCount: 0,
            quotedPremiumCents: 0,
            soldPremiumCents: 0,
          });
        }
        const entry = productTypeMap.get(pt)!;
        entry.quotedCount++;
        entry.quotedPremiumCents += q.premiumCents;
      });

      h.sales.forEach(s => {
        const pt = s.productType || 'Other';
        if (!productTypeMap.has(pt)) {
          productTypeMap.set(pt, {
            quotedCount: 0,
            soldCount: 0,
            quotedPremiumCents: 0,
            soldPremiumCents: 0,
          });
        }
        const entry = productTypeMap.get(pt)!;
        entry.soldCount++;
        entry.soldPremiumCents += s.premiumCents;
      });
    });

    const byProductType: ProductTypeBreakdown[] = Array.from(productTypeMap.entries())
      .map(([pt, entry]) => ({
        productType: pt,
        quotedCount: entry.quotedCount,
        soldCount: entry.soldCount,
        quotedPremiumCents: entry.quotedPremiumCents,
        soldPremiumCents: entry.soldPremiumCents,
        closeRatio: entry.quotedCount > 0
          ? (entry.soldCount / entry.quotedCount) * 100
          : null,
      }))
      .sort((a, b) => b.soldPremiumCents - a.soldPremiumCents);

    // Calculate trend data
    // Determine aggregation period based on date range
    const daysDiff = dateRange
      ? differenceInDays(dateRange.end, dateRange.start)
      : 365;
    const useWeekly = daysDiff <= 90;

    const trendMap = new Map<string, {
      periodLabel: string;
      quotedHouseholds: Set<string>;
      soldHouseholds: Set<string>;
      premiumCents: number;
    }>();

    // Helper to get period key
    const getPeriodKey = (dateStr: string) => {
      const date = new Date(dateStr);
      if (useWeekly) {
        const weekStart = startOfWeek(date, { weekStartsOn: 1 });
        return format(weekStart, 'yyyy-MM-dd');
      } else {
        return format(startOfMonth(date), 'yyyy-MM');
      }
    };

    const getPeriodLabel = (key: string) => {
      if (useWeekly) {
        return format(new Date(key), 'MMM d');
      } else {
        return format(new Date(key + '-01'), 'MMM yyyy');
      }
    };

    households.forEach(h => {
      // Add quotes to trend
      h.quotes.forEach(q => {
        if (q.quoteDate) {
          const key = getPeriodKey(q.quoteDate);
          if (!trendMap.has(key)) {
            trendMap.set(key, {
              periodLabel: getPeriodLabel(key),
              quotedHouseholds: new Set(),
              soldHouseholds: new Set(),
              premiumCents: 0,
            });
          }
          trendMap.get(key)!.quotedHouseholds.add(h.id);
        }
      });

      // Add sales to trend
      h.sales.forEach(s => {
        if (s.saleDate) {
          const key = getPeriodKey(s.saleDate);
          if (!trendMap.has(key)) {
            trendMap.set(key, {
              periodLabel: getPeriodLabel(key),
              quotedHouseholds: new Set(),
              soldHouseholds: new Set(),
              premiumCents: 0,
            });
          }
          const entry = trendMap.get(key)!;
          entry.soldHouseholds.add(h.id);
          entry.premiumCents += s.premiumCents;
        }
      });
    });

    const trendData: TrendDataPoint[] = Array.from(trendMap.entries())
      .map(([key, entry]) => ({
        periodKey: key,
        periodLabel: entry.periodLabel,
        quotedHouseholds: entry.quotedHouseholds.size,
        soldHouseholds: entry.soldHouseholds.size,
        premiumCents: entry.premiumCents,
      }))
      .sort((a, b) => a.periodKey.localeCompare(b.periodKey));

    return {
      teamMemberId,
      teamMemberName,
      viewMode,
      summary: {
        totalHouseholds: households.length,
        quotedHouseholds,
        soldHouseholds,
        closeRatio,
        quotedPremiumCents: totalQuotedPremiumCents,
        soldPremiumCents: totalSoldPremiumCents,
      },
      byLeadSource,
      byProductType,
      trendData,
      households,
    };
  }, [teamMembersQuery.data, leadSourcesQuery.data, householdsQuery.data, teamMemberId, viewMode, dateRange]);

  const isLoading = teamMembersQuery.isLoading || leadSourcesQuery.isLoading || householdsQuery.isLoading;
  const error = teamMembersQuery.error || leadSourcesQuery.error || householdsQuery.error;

  return {
    data,
    isLoading,
    error,
  };
}
