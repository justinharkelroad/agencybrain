import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMemo } from 'react';
import { format } from 'date-fns';

export interface ObjectionFrequency {
  objectionId: string | null;
  objectionName: string;
  total: number;
  stillLead: number;
  stillQuoted: number;
  soldDespite: number;
  percentage: number;
}

export interface ObjectionByGroup {
  groupId: string | null;
  groupName: string;
  nonSold: number;
  withObjection: number;
  objectionRate: number | null;
  topObjection: string | null;
}

export interface ObjectionTrendPoint {
  month: string;
  totalHouseholds: number;
  withObjection: number;
  objectionRate: number | null;
}

export interface ObjectionAnalysisData {
  totalNonSold: number;
  withObjection: number;
  withoutObjection: number;
  objectionRate: number | null;
  frequencies: ObjectionFrequency[];
  bySource: ObjectionByGroup[];
  byProducer: ObjectionByGroup[];
  trend: ObjectionTrendPoint[];
  hasSufficientData: boolean;
}

interface HouseholdRow {
  id: string;
  status: string;
  objection_id: string | null;
  lead_source_id: string | null;
  first_quote_date: string | null;
}

interface ObjectionRow {
  id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
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

const PAGE_SIZE = 1000;
const MAX_FETCH = 20000;

export function useLqsObjectionAnalysis(
  agencyId: string | null,
  dateRange: { start: Date; end: Date } | null
) {
  // Fetch objections
  const objectionsQuery = useQuery({
    queryKey: ['lqs-objanalysis-objections', agencyId],
    enabled: !!agencyId,
    staleTime: 30000,
    queryFn: async (): Promise<ObjectionRow[]> => {
      const { data, error } = await supabase
        .from('lqs_objections')
        .select('id, name, is_active, sort_order')
        .eq('agency_id', agencyId!)
        .order('sort_order');
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch lead sources
  const leadSourcesQuery = useQuery({
    queryKey: ['lqs-objanalysis-lead-sources', agencyId],
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
    queryKey: ['lqs-objanalysis-buckets', agencyId],
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
    queryKey: ['lqs-objanalysis-team-members', agencyId],
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

  // Fetch households
  const householdsQuery = useQuery({
    queryKey: ['lqs-objanalysis-households', agencyId, dateRange?.start?.toISOString(), dateRange?.end?.toISOString()],
    enabled: !!agencyId,
    staleTime: 30000,
    queryFn: async (): Promise<HouseholdRow[]> => {
      const allRows: HouseholdRow[] = [];
      for (let from = 0; from < MAX_FETCH; from += PAGE_SIZE) {
        let query = supabase
          .from('lqs_households')
          .select('id, status, objection_id, lead_source_id, first_quote_date')
          .eq('agency_id', agencyId!)
          .not('first_quote_date', 'is', null); // Only households that have been quoted

        if (dateRange) {
          const startStr = format(dateRange.start, 'yyyy-MM-dd');
          const endStr = format(dateRange.end, 'yyyy-MM-dd');
          query = query.gte('first_quote_date', startStr).lte('first_quote_date', endStr);
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

  // Fetch quotes for producer attribution
  const quotesQuery = useQuery({
    queryKey: ['lqs-objanalysis-quotes', agencyId],
    enabled: !!agencyId,
    staleTime: 30000,
    queryFn: async (): Promise<QuoteRow[]> => {
      const allRows: QuoteRow[] = [];
      for (let from = 0; from < MAX_FETCH; from += PAGE_SIZE) {
        const { data: page, error } = await supabase
          .from('lqs_quotes')
          .select('household_id, team_member_id, quote_date')
          .eq('agency_id', agencyId!)
          .order('quote_date', { ascending: true })
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        if (!page || page.length === 0) break;
        allRows.push(...(page as QuoteRow[]));
        if (page.length < PAGE_SIZE) break;
      }
      return allRows;
    },
  });

  const data = useMemo<ObjectionAnalysisData | null>(() => {
    const objections = objectionsQuery.data;
    const leadSources = leadSourcesQuery.data;
    const buckets = bucketsQuery.data;
    const teamMembers = teamMembersQuery.data;
    const households = householdsQuery.data;
    const quotes = quotesQuery.data;

    if (!objections || !leadSources || !buckets || !teamMembers || !households || !quotes) return null;

    // Build lookup maps
    const objectionNameMap = new Map(objections.map(o => [o.id, o.name]));
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

    // Count ALL households (not just non-sold)
    const totalHouseholds = households.length;
    const totalNonSold = households.filter(h => h.status !== 'sold').length;
    const withObjection = households.filter(h => h.objection_id !== null).length;
    const withoutObjection = totalHouseholds - withObjection;
    const hasSufficientData = withObjection >= 5;

    // Objection frequency
    const freqMap = new Map<string | null, { total: number; stillLead: number; stillQuoted: number; soldDespite: number }>();

    households.forEach(h => {
      if (h.objection_id === null) return; // Skip no-objection for frequency chart

      if (!freqMap.has(h.objection_id)) {
        freqMap.set(h.objection_id, { total: 0, stillLead: 0, stillQuoted: 0, soldDespite: 0 });
      }
      const entry = freqMap.get(h.objection_id)!;
      entry.total++;
      if (h.status === 'lead') entry.stillLead++;
      else if (h.status === 'quoted') entry.stillQuoted++;
      else if (h.status === 'sold') entry.soldDespite++;
    });

    const frequencies: ObjectionFrequency[] = Array.from(freqMap.entries())
      .map(([objId, counts]) => ({
        objectionId: objId,
        objectionName: objId ? (objectionNameMap.get(objId) || 'Unknown') : 'No Objection Set',
        ...counts,
        percentage: totalHouseholds > 0 ? (counts.total / totalHouseholds) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);

    // By source
    const bySourceMap = new Map<string | null, { nonSold: number; withObjection: number; objectionCounts: Map<string | null, number> }>();
    households.forEach(h => {
      const sourceKey = h.lead_source_id;
      if (!bySourceMap.has(sourceKey)) {
        bySourceMap.set(sourceKey, { nonSold: 0, withObjection: 0, objectionCounts: new Map() });
      }
      const entry = bySourceMap.get(sourceKey)!;
      if (h.status !== 'sold') entry.nonSold++;
      if (h.objection_id !== null) {
        entry.withObjection++;
        entry.objectionCounts.set(h.objection_id, (entry.objectionCounts.get(h.objection_id) || 0) + 1);
      }
    });

    const bySource: ObjectionByGroup[] = Array.from(bySourceMap.entries())
      .map(([sourceId, entry]) => {
        let topObjection: string | null = null;
        let topCount = 0;
        entry.objectionCounts.forEach((count, objId) => {
          if (count > topCount) {
            topCount = count;
            topObjection = objId ? (objectionNameMap.get(objId) || 'Unknown') : null;
          }
        });

        return {
          groupId: sourceId,
          groupName: getSourceDisplayName(sourceId),
          nonSold: entry.nonSold,
          withObjection: entry.withObjection,
          objectionRate: entry.nonSold > 0 ? (entry.withObjection / entry.nonSold) * 100 : null,
          topObjection,
        };
      })
      .sort((a, b) => b.withObjection - a.withObjection);

    // By producer
    const byProducerMap = new Map<string | null, { nonSold: number; withObjection: number; objectionCounts: Map<string | null, number> }>();
    households.forEach(h => {
      const producerKey = primaryProducerMap.get(h.id) ?? null;
      if (!byProducerMap.has(producerKey)) {
        byProducerMap.set(producerKey, { nonSold: 0, withObjection: 0, objectionCounts: new Map() });
      }
      const entry = byProducerMap.get(producerKey)!;
      if (h.status !== 'sold') entry.nonSold++;
      if (h.objection_id !== null) {
        entry.withObjection++;
        entry.objectionCounts.set(h.objection_id, (entry.objectionCounts.get(h.objection_id) || 0) + 1);
      }
    });

    const byProducer: ObjectionByGroup[] = Array.from(byProducerMap.entries())
      .map(([producerId, entry]) => {
        let topObjection: string | null = null;
        let topCount = 0;
        entry.objectionCounts.forEach((count, objId) => {
          if (count > topCount) {
            topCount = count;
            topObjection = objId ? (objectionNameMap.get(objId) || 'Unknown') : null;
          }
        });

        return {
          groupId: producerId,
          groupName: producerId ? (teamMemberNameMap.get(producerId) || 'Unknown') : 'Unassigned',
          nonSold: entry.nonSold,
          withObjection: entry.withObjection,
          objectionRate: entry.nonSold > 0 ? (entry.withObjection / entry.nonSold) * 100 : null,
          topObjection,
        };
      })
      .sort((a, b) => b.withObjection - a.withObjection);

    // Monthly trend
    const trendMap = new Map<string, { totalHouseholds: number; withObjection: number }>();
    households.forEach(h => {
      if (!h.first_quote_date) return;
      const month = format(new Date(h.first_quote_date), 'yyyy-MM');
      if (!trendMap.has(month)) {
        trendMap.set(month, { totalHouseholds: 0, withObjection: 0 });
      }
      const entry = trendMap.get(month)!;
      entry.totalHouseholds++;
      if (h.objection_id !== null) entry.withObjection++;
    });

    const trend: ObjectionTrendPoint[] = Array.from(trendMap.entries())
      .map(([month, entry]) => ({
        month,
        totalHouseholds: entry.totalHouseholds,
        withObjection: entry.withObjection,
        objectionRate: entry.totalHouseholds > 0
          ? (entry.withObjection / entry.totalHouseholds) * 100
          : null,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return {
      totalNonSold,
      withObjection,
      withoutObjection,
      objectionRate: totalHouseholds > 0 ? (withObjection / totalHouseholds) * 100 : null,
      frequencies,
      bySource,
      byProducer,
      trend,
      hasSufficientData,
    };
  }, [objectionsQuery.data, leadSourcesQuery.data, bucketsQuery.data, teamMembersQuery.data, householdsQuery.data, quotesQuery.data]);

  const isLoading = objectionsQuery.isLoading || leadSourcesQuery.isLoading || bucketsQuery.isLoading
    || teamMembersQuery.isLoading || householdsQuery.isLoading || quotesQuery.isLoading;
  const error = objectionsQuery.error || leadSourcesQuery.error || bucketsQuery.error
    || teamMembersQuery.error || householdsQuery.error || quotesQuery.error;

  return { data, isLoading, error };
}
