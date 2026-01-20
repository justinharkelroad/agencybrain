import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMemo } from 'react';
import { format, subDays, startOfQuarter, startOfYear } from 'date-fns';
import { DateRangePreset, getDateRangeFromPreset } from './useLqsRoiAnalytics';

export interface ProducerMetrics {
  teamMemberId: string | null;
  teamMemberName: string;
  // Quoted metrics
  quotedHouseholds: number;
  quotedPolicies: number;
  quotedItems: number;
  quotedPremiumCents: number;
  // Sold metrics
  soldHouseholds: number;
  soldPolicies: number;
  soldItems: number;
  soldPremiumCents: number;
  // Rates
  closeRatio: number | null; // Sold HH / Quoted HH
  bundleRatio: number | null; // % of sold HH with 2+ products
}

export interface ProducerBreakdownData {
  byQuotedBy: ProducerMetrics[];
  bySoldBy: ProducerMetrics[];
  totals: {
    quotedHouseholds: number;
    quotedPolicies: number;
    quotedItems: number;
    quotedPremiumCents: number;
    soldHouseholds: number;
    soldPolicies: number;
    soldItems: number;
    soldPremiumCents: number;
  };
}

// Quote row with team member
interface QuoteRow {
  household_id: string;
  team_member_id: string | null;
  items_quoted: number | null;
  premium_cents: number | null;
  product_type: string | null;
}

// Sale row with team member
interface SaleRow {
  household_id: string;
  team_member_id: string | null;
  items_sold: number | null;
  policies_sold: number | null;
  premium_cents: number | null;
  product_type: string | null;
}

// Team member lookup
interface TeamMember {
  id: string;
  name: string;
}

const PAGE_SIZE = 1000;
const MAX_FETCH = 20000;

export function useLqsProducerBreakdown(
  agencyId: string | null,
  dateRange: { start: Date; end: Date } | null
) {
  const isDateFiltered = dateRange !== null;

  // Fetch team members
  const teamMembersQuery = useQuery({
    queryKey: ['lqs-producer-team-members', agencyId],
    enabled: !!agencyId,
    queryFn: async (): Promise<TeamMember[]> => {
      const { data, error } = await supabase
        .from('team_members')
        .select('id, name')
        .eq('agency_id', agencyId!);

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch quotes (all or date filtered)
  const quotesQuery = useQuery({
    queryKey: ['lqs-producer-quotes', agencyId, dateRange?.start?.toISOString(), dateRange?.end?.toISOString()],
    enabled: !!agencyId,
    queryFn: async (): Promise<QuoteRow[]> => {
      const allRows: QuoteRow[] = [];

      for (let from = 0; from < MAX_FETCH; from += PAGE_SIZE) {
        let query = supabase
          .from('lqs_quotes')
          .select('household_id, team_member_id, items_quoted, premium_cents, product_type')
          .eq('agency_id', agencyId!);

        if (dateRange) {
          const startStr = format(dateRange.start, 'yyyy-MM-dd');
          const endStr = format(dateRange.end, 'yyyy-MM-dd');
          query = query.gte('quote_date', startStr).lte('quote_date', endStr);
        }

        const { data: page, error } = await query.range(from, from + PAGE_SIZE - 1);

        if (error) throw error;
        if (!page || page.length === 0) break;

        allRows.push(...(page as QuoteRow[]));
        if (page.length < PAGE_SIZE) break;
      }

      return allRows;
    },
  });

  // Fetch sales (all or date filtered)
  const salesQuery = useQuery({
    queryKey: ['lqs-producer-sales', agencyId, dateRange?.start?.toISOString(), dateRange?.end?.toISOString()],
    enabled: !!agencyId,
    queryFn: async (): Promise<SaleRow[]> => {
      const allRows: SaleRow[] = [];

      for (let from = 0; from < MAX_FETCH; from += PAGE_SIZE) {
        let query = supabase
          .from('lqs_sales')
          .select('household_id, team_member_id, items_sold, policies_sold, premium_cents, product_type')
          .eq('agency_id', agencyId!);

        if (dateRange) {
          const startStr = format(dateRange.start, 'yyyy-MM-dd');
          const endStr = format(dateRange.end, 'yyyy-MM-dd');
          query = query.gte('sale_date', startStr).lte('sale_date', endStr);
        }

        const { data: page, error } = await query.range(from, from + PAGE_SIZE - 1);

        if (error) throw error;
        if (!page || page.length === 0) break;

        allRows.push(...(page as SaleRow[]));
        if (page.length < PAGE_SIZE) break;
      }

      return allRows;
    },
  });

  // Aggregate data by producer
  const data = useMemo<ProducerBreakdownData | null>(() => {
    const teamMembers = teamMembersQuery.data;
    const quotes = quotesQuery.data;
    const sales = salesQuery.data;

    if (!teamMembers || !quotes || !sales) return null;

    // Build team member name map
    const teamMemberNameMap = new Map(teamMembers.map(tm => [tm.id, tm.name]));

    // =============== QUOTED BY View ===============
    interface QuotedByMetrics {
      quotedHouseholdIds: Set<string>;
      quotedPolicies: number;
      quotedItems: number;
      quotedPremiumCents: number;
      // Need to track sales by these same households for close ratio
      // But we'll calculate close ratio differently - based on who quoted
    }

    const quotedByMap = new Map<string | null, QuotedByMetrics>();

    quotes.forEach(q => {
      const memberId = q.team_member_id;
      if (!quotedByMap.has(memberId)) {
        quotedByMap.set(memberId, {
          quotedHouseholdIds: new Set(),
          quotedPolicies: 0,
          quotedItems: 0,
          quotedPremiumCents: 0,
        });
      }
      const metrics = quotedByMap.get(memberId)!;
      metrics.quotedHouseholdIds.add(q.household_id);
      metrics.quotedPolicies++;
      metrics.quotedItems += q.items_quoted || 1;
      metrics.quotedPremiumCents += q.premium_cents || 0;
    });

    // For close ratio in "Quoted By" view, we need to see which of the quoted households got sold
    // We'll track which households have sales (regardless of who sold)
    const soldHouseholdIds = new Set(sales.map(s => s.household_id));
    const productTypesByHousehold = new Map<string, Set<string>>();
    sales.forEach(s => {
      if (!productTypesByHousehold.has(s.household_id)) {
        productTypesByHousehold.set(s.household_id, new Set());
      }
      if (s.product_type) {
        productTypesByHousehold.get(s.household_id)!.add(s.product_type);
      }
    });

    const byQuotedBy: ProducerMetrics[] = Array.from(quotedByMap.entries()).map(([memberId, metrics]) => {
      const name = memberId ? (teamMemberNameMap.get(memberId) || 'Unknown') : 'Unassigned';

      // Calculate close ratio: how many of the households this person quoted got sold?
      const quotedThatSold = Array.from(metrics.quotedHouseholdIds).filter(hid => soldHouseholdIds.has(hid)).length;
      const closeRatio = metrics.quotedHouseholdIds.size > 0
        ? (quotedThatSold / metrics.quotedHouseholdIds.size) * 100
        : null;

      // Bundle ratio for quoted households that sold
      const quotedAndSoldIds = Array.from(metrics.quotedHouseholdIds).filter(hid => soldHouseholdIds.has(hid));
      const bundledCount = quotedAndSoldIds.filter(hid => {
        const types = productTypesByHousehold.get(hid);
        return types && types.size >= 2;
      }).length;
      const bundleRatio = quotedAndSoldIds.length > 0 ? (bundledCount / quotedAndSoldIds.length) * 100 : null;

      // For "Quoted By" view, sold metrics are those quoted HH that ended up sold
      // Premium for sold would come from sales - but we need to attribute correctly
      // For simplicity, we'll just count how many converted and not show sold premium in quoted by view
      return {
        teamMemberId: memberId,
        teamMemberName: name,
        quotedHouseholds: metrics.quotedHouseholdIds.size,
        quotedPolicies: metrics.quotedPolicies,
        quotedItems: metrics.quotedItems,
        quotedPremiumCents: metrics.quotedPremiumCents,
        // Sold metrics in "Quoted By" view = how many they quoted that got sold (by anyone)
        soldHouseholds: quotedThatSold,
        soldPolicies: 0, // Not meaningful in quoted by view
        soldItems: 0,
        soldPremiumCents: 0,
        closeRatio,
        bundleRatio,
      };
    }).sort((a, b) => b.quotedHouseholds - a.quotedHouseholds);

    // =============== SOLD BY View ===============
    interface SoldByMetrics {
      soldHouseholdIds: Set<string>;
      soldPolicies: number;
      soldItems: number;
      soldPremiumCents: number;
      productTypesPerHousehold: Map<string, Set<string>>;
    }

    const soldByMap = new Map<string | null, SoldByMetrics>();

    sales.forEach(s => {
      const memberId = s.team_member_id;
      if (!soldByMap.has(memberId)) {
        soldByMap.set(memberId, {
          soldHouseholdIds: new Set(),
          soldPolicies: 0,
          soldItems: 0,
          soldPremiumCents: 0,
          productTypesPerHousehold: new Map(),
        });
      }
      const metrics = soldByMap.get(memberId)!;
      metrics.soldHouseholdIds.add(s.household_id);
      metrics.soldPolicies += s.policies_sold || 1;
      metrics.soldItems += s.items_sold || 1;
      metrics.soldPremiumCents += s.premium_cents || 0;

      // Track product types for bundle ratio
      if (!metrics.productTypesPerHousehold.has(s.household_id)) {
        metrics.productTypesPerHousehold.set(s.household_id, new Set());
      }
      if (s.product_type) {
        metrics.productTypesPerHousehold.get(s.household_id)!.add(s.product_type);
      }
    });

    // For "Sold By" view, we need quoted metrics - how many did this person's sold HH have quoted?
    const quotedHouseholdIds = new Set(quotes.map(q => q.household_id));

    const bySoldBy: ProducerMetrics[] = Array.from(soldByMap.entries()).map(([memberId, metrics]) => {
      const name = memberId ? (teamMemberNameMap.get(memberId) || 'Unknown') : 'Unassigned';

      // Bundle ratio
      let bundledCount = 0;
      metrics.productTypesPerHousehold.forEach((types) => {
        if (types.size >= 2) bundledCount++;
      });
      const bundleRatio = metrics.soldHouseholdIds.size > 0 ? (bundledCount / metrics.soldHouseholdIds.size) * 100 : null;

      // In "Sold By" view, close ratio doesn't make as much sense
      // We could show it as sold vs total quoted for this producer, but that's confusing
      // Better to just show null or calculate as % of all quoted that this person sold
      const closeRatio = quotedHouseholdIds.size > 0
        ? (metrics.soldHouseholdIds.size / quotedHouseholdIds.size) * 100
        : null;

      return {
        teamMemberId: memberId,
        teamMemberName: name,
        // In "Sold By" view, quoted metrics are less relevant but we can show 0
        quotedHouseholds: 0,
        quotedPolicies: 0,
        quotedItems: 0,
        quotedPremiumCents: 0,
        soldHouseholds: metrics.soldHouseholdIds.size,
        soldPolicies: metrics.soldPolicies,
        soldItems: metrics.soldItems,
        soldPremiumCents: metrics.soldPremiumCents,
        closeRatio, // Share of all quoted HH that this person sold
        bundleRatio,
      };
    }).sort((a, b) => b.soldPremiumCents - a.soldPremiumCents);

    // Calculate totals
    const uniqueQuotedHH = new Set(quotes.map(q => q.household_id));
    const uniqueSoldHH = new Set(sales.map(s => s.household_id));

    const totals = {
      quotedHouseholds: uniqueQuotedHH.size,
      quotedPolicies: quotes.length,
      quotedItems: quotes.reduce((sum, q) => sum + (q.items_quoted || 1), 0),
      quotedPremiumCents: quotes.reduce((sum, q) => sum + (q.premium_cents || 0), 0),
      soldHouseholds: uniqueSoldHH.size,
      soldPolicies: sales.reduce((sum, s) => sum + (s.policies_sold || 1), 0),
      soldItems: sales.reduce((sum, s) => sum + (s.items_sold || 1), 0),
      soldPremiumCents: sales.reduce((sum, s) => sum + (s.premium_cents || 0), 0),
    };

    return { byQuotedBy, bySoldBy, totals };
  }, [teamMembersQuery.data, quotesQuery.data, salesQuery.data]);

  const isLoading = teamMembersQuery.isLoading || quotesQuery.isLoading || salesQuery.isLoading;
  const error = teamMembersQuery.error || quotesQuery.error || salesQuery.error;

  return {
    data,
    isLoading,
    error,
    refetch: () => {
      teamMembersQuery.refetch();
      quotesQuery.refetch();
      salesQuery.refetch();
    },
  };
}
