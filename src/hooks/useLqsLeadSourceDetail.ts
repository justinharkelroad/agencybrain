import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMemo } from 'react';
import { format } from 'date-fns';

export interface HouseholdDetailRow {
  id: string;
  firstName: string;
  lastName: string;
  status: string | null;
  leadReceivedDate: string | null;
  firstQuoteDate: string | null;
  soldDate: string | null;
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

export interface LeadSourceDetailData {
  leadSourceId: string | null;
  leadSourceName: string;
  households: HouseholdDetailRow[];
  summary: {
    totalHouseholds: number;
    leadsCount: number;
    quotedCount: number;
    soldCount: number;
    totalQuotedPremiumCents: number;
    totalSoldPremiumCents: number;
  };
}

const PAGE_SIZE = 500;
const MAX_FETCH = 5000;

export function useLqsLeadSourceDetail(
  agencyId: string | null,
  leadSourceId: string | null | undefined,
  dateRange: { start: Date; end: Date } | null
) {
  // Only run query when leadSourceId is explicitly provided (including null for unattributed)
  const isEnabled = !!agencyId && leadSourceId !== undefined;

  // Fetch team members for name lookup
  const teamMembersQuery = useQuery({
    queryKey: ['lqs-detail-team-members', agencyId],
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

  // Fetch households for this lead source
  const householdsQuery = useQuery({
    queryKey: ['lqs-detail-households', agencyId, leadSourceId, dateRange?.start?.toISOString(), dateRange?.end?.toISOString()],
    enabled: isEnabled,
    queryFn: async () => {
      const allRows: any[] = [];

      for (let from = 0; from < MAX_FETCH; from += PAGE_SIZE) {
        let query = supabase
          .from('lqs_households')
          .select(`
            id,
            first_name,
            last_name,
            status,
            lead_received_date,
            first_quote_date,
            sold_date,
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
          .eq('agency_id', agencyId!);

        // Handle null lead source (unattributed)
        if (leadSourceId === null) {
          query = query.is('lead_source_id', null);
        } else {
          query = query.eq('lead_source_id', leadSourceId);
        }

        const { data: page, error } = await query
          .order('lead_received_date', { ascending: false, nullsFirst: false })
          .range(from, from + PAGE_SIZE - 1);

        if (error) throw error;
        if (!page || page.length === 0) break;

        // Filter in memory if date range provided
        if (dateRange) {
          const filtered = page.filter(h => {
            const dateToUse = h.lead_received_date || (h as any).created_at;
            if (!dateToUse) return true; // Include if no date
            const d = new Date(dateToUse);
            return d >= dateRange.start && d <= dateRange.end;
          });
          allRows.push(...filtered);
        } else {
          allRows.push(...page);
        }
        if (page.length < PAGE_SIZE) break;
      }

      return allRows;
    },
  });

  // Fetch lead source name
  const leadSourceNameQuery = useQuery({
    queryKey: ['lqs-detail-source-name', leadSourceId],
    enabled: isEnabled && leadSourceId !== null,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_sources')
        .select('name')
        .eq('id', leadSourceId!)
        .single();

      if (error) return 'Unknown';
      return data?.name || 'Unknown';
    },
  });

  // Process data
  const data = useMemo<LeadSourceDetailData | null>(() => {
    const teamMemberMap = teamMembersQuery.data;
    const householdsRaw = householdsQuery.data;

    if (!teamMemberMap || !householdsRaw) return null;

    const leadSourceName = leadSourceId === null
      ? 'Unattributed'
      : (leadSourceNameQuery.data || 'Loading...');

    let leadsCount = 0;
    let quotedCount = 0;
    let soldCount = 0;
    let totalQuotedPremiumCents = 0;
    let totalSoldPremiumCents = 0;

    const households: HouseholdDetailRow[] = householdsRaw.map((h: any) => {
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

      // Count statuses
      if (h.status === 'lead') leadsCount++;
      if (h.status === 'quoted') quotedCount++;
      if (h.status === 'sold') soldCount++;

      // Aggregate metrics
      const quotedPolicies = quotes.length;
      const quotedItems = quotes.reduce((sum: number, q: any) => sum + q.itemsQuoted, 0);
      const quotedPremiumCents = quotes.reduce((sum: number, q: any) => sum + q.premiumCents, 0);
      totalQuotedPremiumCents += quotedPremiumCents;

      const soldPolicies = sales.reduce((sum: number, s: any) => sum + s.policiesSold, 0);
      const soldItems = sales.reduce((sum: number, s: any) => sum + s.itemsSold, 0);
      const soldPremiumCents = sales.reduce((sum: number, s: any) => sum + s.premiumCents, 0);
      totalSoldPremiumCents += soldPremiumCents;

      return {
        id: h.id,
        firstName: h.first_name,
        lastName: h.last_name,
        status: h.status,
        leadReceivedDate: h.lead_received_date,
        firstQuoteDate: h.first_quote_date,
        soldDate: h.sold_date,
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

    return {
      leadSourceId,
      leadSourceName,
      households,
      summary: {
        totalHouseholds: households.length,
        leadsCount,
        quotedCount,
        soldCount,
        totalQuotedPremiumCents,
        totalSoldPremiumCents,
      },
    };
  }, [teamMembersQuery.data, householdsQuery.data, leadSourceNameQuery.data, leadSourceId]);

  const isLoading = teamMembersQuery.isLoading || householdsQuery.isLoading ||
    (leadSourceId !== null && leadSourceNameQuery.isLoading);
  const error = teamMembersQuery.error || householdsQuery.error || leadSourceNameQuery.error;

  return {
    data,
    isLoading,
    error,
  };
}
