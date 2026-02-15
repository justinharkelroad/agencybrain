import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMemo } from 'react';
import { format, differenceInCalendarDays, subDays } from 'date-fns';

export interface TimeToCloseData {
  avgDays: number;
  medianDays: number;
  closedDeals: number;
  staleQuotes: number;
  distribution: Array<{
    label: string;
    count: number;
    color: string;
    min: number;
    max: number;
  }>;
  bySource: Array<{
    sourceId: string | null;
    sourceName: string;
    avgDays: number;
    medianDays: number;
    count: number;
  }>;
  byProducer: Array<{
    teamMemberId: string | null;
    producerName: string;
    avgDays: number;
    medianDays: number;
    count: number;
  }>;
  staleBySource: Array<{
    sourceId: string | null;
    sourceName: string;
    count: number;
  }>;
  soldHouseholdsEnriched: FilteredHousehold[];
  staleHouseholdsEnriched: FilteredHousehold[];
  oneCallCloses: number;
  oneCallCloseRate: number | null;
  oneCallCloseHouseholdIds: Set<string>;
}

export interface FilteredHousehold {
  id: string;
  customerName: string;
  status: string;
  firstQuoteDate: string | null;
  soldDate: string | null;
  daysToClose: number | null;
  leadSourceName: string;
  producerName: string;
  leadSourceId: string | null;
  teamMemberId: string | null;
}

interface HouseholdRow {
  id: string;
  first_name: string;
  last_name: string;
  status: string;
  first_quote_date: string | null;
  sold_date: string | null;
  lead_source_id: string | null;
}

interface QuoteRow {
  household_id: string;
  team_member_id: string | null;
  quote_date: string | null;
}

interface LeadSourceRow {
  id: string;
  name: string;
  bucket_id: string | null;
}

interface MarketingBucket {
  id: string;
  name: string;
}

interface TeamMember {
  id: string;
  name: string;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

const PAGE_SIZE = 1000;
const MAX_FETCH = 20000;

export function useLqsTimeToClose(
  agencyId: string | null,
  dateRange: { start: Date; end: Date } | null
) {
  // Fetch lead sources
  const leadSourcesQuery = useQuery({
    queryKey: ['lqs-ttc-lead-sources', agencyId],
    enabled: !!agencyId,
    staleTime: 30000,
    queryFn: async (): Promise<LeadSourceRow[]> => {
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
    queryKey: ['lqs-ttc-buckets', agencyId],
    enabled: !!agencyId,
    staleTime: 30000,
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

  // Fetch team members
  const teamMembersQuery = useQuery({
    queryKey: ['lqs-ttc-team-members', agencyId],
    enabled: !!agencyId,
    staleTime: 30000,
    queryFn: async (): Promise<TeamMember[]> => {
      const { data, error } = await supabase
        .from('team_members')
        .select('id, name')
        .eq('agency_id', agencyId!);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch sold households (filter by sold_date in range)
  const soldHouseholdsQuery = useQuery({
    queryKey: ['lqs-ttc-sold', agencyId, dateRange?.start?.toISOString(), dateRange?.end?.toISOString()],
    enabled: !!agencyId,
    staleTime: 30000,
    queryFn: async (): Promise<HouseholdRow[]> => {
      const allRows: HouseholdRow[] = [];
      for (let from = 0; from < MAX_FETCH; from += PAGE_SIZE) {
        let query = supabase
          .from('lqs_households')
          .select('id, first_name, last_name, status, first_quote_date, sold_date, lead_source_id')
          .eq('agency_id', agencyId!)
          .eq('status', 'sold')
          .not('first_quote_date', 'is', null)
          .not('sold_date', 'is', null);

        if (dateRange) {
          const startStr = format(dateRange.start, 'yyyy-MM-dd');
          const endStr = format(dateRange.end, 'yyyy-MM-dd');
          query = query.gte('sold_date', startStr).lte('sold_date', endStr);
        }

        const { data: page, error } = await query.range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        if (!page || page.length === 0) break;
        allRows.push(...(page as HouseholdRow[]));
        if (page.length < PAGE_SIZE) break;
      }
      return allRows;
    },
  });

  // Fetch stale quotes: quoted > 30 days ago, not sold
  const staleHouseholdsQuery = useQuery({
    queryKey: ['lqs-ttc-stale', agencyId],
    enabled: !!agencyId,
    staleTime: 30000,
    queryFn: async (): Promise<HouseholdRow[]> => {
      const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd');
      const allRows: HouseholdRow[] = [];
      for (let from = 0; from < MAX_FETCH; from += PAGE_SIZE) {
        const { data: page, error } = await supabase
          .from('lqs_households')
          .select('id, first_name, last_name, status, first_quote_date, sold_date, lead_source_id')
          .eq('agency_id', agencyId!)
          .neq('status', 'sold')
          .not('first_quote_date', 'is', null)
          .lte('first_quote_date', thirtyDaysAgo)
          .range(from, from + PAGE_SIZE - 1);

        if (error) throw error;
        if (!page || page.length === 0) break;
        allRows.push(...(page as HouseholdRow[]));
        if (page.length < PAGE_SIZE) break;
      }
      return allRows;
    },
  });

  // Fetch quotes for producer attribution (earliest quote per household)
  const quotesQuery = useQuery({
    queryKey: ['lqs-ttc-quotes', agencyId],
    enabled: !!agencyId,
    staleTime: 30000,
    queryFn: async (): Promise<QuoteRow[]> => {
      const allRows: QuoteRow[] = [];
      for (let from = 0; from < MAX_FETCH; from += PAGE_SIZE) {
        let query = supabase
          .from('lqs_quotes')
          .select('household_id, team_member_id, quote_date')
          .eq('agency_id', agencyId!)
          .order('quote_date', { ascending: true });

        const { data: page, error } = await query.range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        if (!page || page.length === 0) break;
        allRows.push(...(page as QuoteRow[]));
        if (page.length < PAGE_SIZE) break;
      }
      return allRows;
    },
  });

  // Fetch one-call close household IDs from lqs_sales
  const occQuery = useQuery({
    queryKey: ['lqs-ttc-occ', agencyId, dateRange?.start?.toISOString(), dateRange?.end?.toISOString()],
    enabled: !!agencyId,
    staleTime: 30000,
    queryFn: async (): Promise<Set<string>> => {
      let query = supabase
        .from('lqs_sales')
        .select('household_id')
        .eq('agency_id', agencyId!)
        .eq('is_one_call_close', true);

      if (dateRange) {
        const startStr = format(dateRange.start, 'yyyy-MM-dd');
        const endStr = format(dateRange.end, 'yyyy-MM-dd');
        query = query.gte('sale_date', startStr).lte('sale_date', endStr);
      }

      const { data, error } = await query;
      if (error) throw error;
      return new Set((data || []).map(r => r.household_id));
    },
  });

  const data = useMemo<TimeToCloseData | null>(() => {
    const leadSources = leadSourcesQuery.data;
    const buckets = bucketsQuery.data;
    const teamMembers = teamMembersQuery.data;
    const soldHouseholds = soldHouseholdsQuery.data;
    const staleHouseholds = staleHouseholdsQuery.data;
    const quotes = quotesQuery.data;
    const occHouseholdIds = occQuery.data;

    if (!leadSources || !buckets || !teamMembers || !soldHouseholds || !staleHouseholds || !quotes || !occHouseholdIds) return null;

    // Build lookup maps
    const sourceNameMap = new Map(leadSources.map(ls => [ls.id, ls.name]));
    const sourceBucketMap = new Map(leadSources.map(ls => [ls.id, ls.bucket_id]));
    const bucketNameMap = new Map(buckets.map(b => [b.id, b.name]));
    const teamMemberNameMap = new Map(teamMembers.map(tm => [tm.id, tm.name]));

    // Build primary producer map (earliest quote per household)
    const primaryProducerMap = new Map<string, string | null>();
    quotes.forEach(q => {
      if (!primaryProducerMap.has(q.household_id)) {
        primaryProducerMap.set(q.household_id, q.team_member_id);
      }
    });

    function getSourceDisplayName(leadSourceId: string | null): string {
      if (!leadSourceId) return 'Unassigned';
      return sourceNameMap.get(leadSourceId) || 'Unknown';
    }

    // Compute days-to-close for each sold household
    const daysList: number[] = [];
    const bySourceMap = new Map<string | null, number[]>();
    const byProducerMap = new Map<string | null, number[]>();

    soldHouseholds.forEach(h => {
      if (!h.first_quote_date || !h.sold_date) return;
      const days = differenceInCalendarDays(new Date(h.sold_date), new Date(h.first_quote_date));
      if (days < 0) return; // skip invalid
      daysList.push(days);

      // By source
      const sourceKey = h.lead_source_id;
      if (!bySourceMap.has(sourceKey)) bySourceMap.set(sourceKey, []);
      bySourceMap.get(sourceKey)!.push(days);

      // By producer
      const producerKey = primaryProducerMap.get(h.id) ?? null;
      if (!byProducerMap.has(producerKey)) byProducerMap.set(producerKey, []);
      byProducerMap.get(producerKey)!.push(days);
    });

    // Distribution buckets
    const distBuckets = [
      { label: '< 7 days', min: 0, max: 6, color: '#22c55e' },
      { label: '7-14 days', min: 7, max: 14, color: '#22c55e' },
      { label: '14-30 days', min: 15, max: 30, color: '#f59e0b' },
      { label: '30-60 days', min: 31, max: 60, color: '#ef4444' },
      { label: '60+ days', min: 61, max: Infinity, color: '#ef4444' },
    ];

    const distribution = distBuckets.map(b => ({
      label: b.label,
      count: daysList.filter(d => d >= b.min && d <= b.max).length,
      color: b.color,
      min: b.min,
      max: b.max,
    }));

    // By source breakdown
    const bySource = Array.from(bySourceMap.entries())
      .map(([sourceId, days]) => ({
        sourceId,
        sourceName: getSourceDisplayName(sourceId),
        avgDays: Math.round(days.reduce((a, b) => a + b, 0) / days.length),
        medianDays: Math.round(median(days)),
        count: days.length,
      }))
      .sort((a, b) => a.avgDays - b.avgDays);

    // By producer breakdown
    const byProducer = Array.from(byProducerMap.entries())
      .map(([memberId, days]) => ({
        teamMemberId: memberId,
        producerName: memberId ? (teamMemberNameMap.get(memberId) || 'Unknown') : 'Unassigned',
        avgDays: Math.round(days.reduce((a, b) => a + b, 0) / days.length),
        medianDays: Math.round(median(days)),
        count: days.length,
      }))
      .sort((a, b) => a.avgDays - b.avgDays);

    // Stale quotes by source
    const staleBySourceMap = new Map<string | null, number>();
    staleHouseholds.forEach(h => {
      const key = h.lead_source_id;
      staleBySourceMap.set(key, (staleBySourceMap.get(key) || 0) + 1);
    });
    const staleBySource = Array.from(staleBySourceMap.entries())
      .map(([sourceId, count]) => ({
        sourceId,
        sourceName: getSourceDisplayName(sourceId),
        count,
      }))
      .sort((a, b) => b.count - a.count);

    // Build enriched household arrays for drill-down
    function enrichHousehold(h: HouseholdRow): FilteredHousehold {
      const days = h.first_quote_date && h.sold_date
        ? differenceInCalendarDays(new Date(h.sold_date), new Date(h.first_quote_date))
        : null;
      const producerId = primaryProducerMap.get(h.id) ?? null;
      return {
        id: h.id,
        customerName: `${h.first_name} ${h.last_name}`.trim() || 'Unknown',
        status: h.status,
        firstQuoteDate: h.first_quote_date,
        soldDate: h.sold_date,
        daysToClose: days !== null && days >= 0 ? days : null,
        leadSourceName: getSourceDisplayName(h.lead_source_id),
        producerName: producerId ? (teamMemberNameMap.get(producerId) || 'Unknown') : 'Unassigned',
        leadSourceId: h.lead_source_id,
        teamMemberId: producerId,
      };
    }

    const enrichedSold = soldHouseholds.map(enrichHousehold);
    const enrichedStale = staleHouseholds.map(enrichHousehold);

    // One-call close stats
    const oneCallCloseCount = enrichedSold.filter(h => occHouseholdIds.has(h.id)).length;
    const oneCallCloseRate = daysList.length > 0 ? oneCallCloseCount / daysList.length : null;

    return {
      avgDays: daysList.length > 0 ? Math.round(daysList.reduce((a, b) => a + b, 0) / daysList.length) : 0,
      medianDays: Math.round(median(daysList)),
      closedDeals: daysList.length,
      staleQuotes: staleHouseholds.length,
      distribution,
      bySource,
      byProducer,
      staleBySource,
      soldHouseholdsEnriched: enrichedSold,
      staleHouseholdsEnriched: enrichedStale,
      oneCallCloses: oneCallCloseCount,
      oneCallCloseRate,
      oneCallCloseHouseholdIds: occHouseholdIds,
    };
  }, [leadSourcesQuery.data, bucketsQuery.data, teamMembersQuery.data, soldHouseholdsQuery.data, staleHouseholdsQuery.data, quotesQuery.data, occQuery.data]);

  const isLoading = leadSourcesQuery.isLoading || bucketsQuery.isLoading || teamMembersQuery.isLoading
    || soldHouseholdsQuery.isLoading || staleHouseholdsQuery.isLoading || quotesQuery.isLoading || occQuery.isLoading;
  const error = leadSourcesQuery.error || bucketsQuery.error || teamMembersQuery.error
    || soldHouseholdsQuery.error || staleHouseholdsQuery.error || quotesQuery.error || occQuery.error;

  return { data, isLoading, error };
}
