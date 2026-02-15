import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMemo } from 'react';
import { format } from 'date-fns';

export type CrossTabMetric = 'closeRate' | 'premium' | 'soldHH';

export interface CrossTabCell {
  quotedHH: number;
  soldHH: number;
  premiumCents: number;
  closeRate: number | null;
}

export interface CrossTabRow {
  teamMemberId: string | null;
  producerName: string;
  cells: Map<string, CrossTabCell>; // keyed by sourceOrBucketId
  total: CrossTabCell;
}

export interface CrossTabData {
  rows: CrossTabRow[];
  columns: Array<{ id: string; name: string }>;
  columnTotals: Map<string, CrossTabCell>;
  grandTotal: CrossTabCell;
}

interface SaleRow {
  household_id: string;
  team_member_id: string | null;
  premium_cents: number | null;
  policies_sold: number | null;
  items_sold: number | null;
}

interface QuoteRow {
  household_id: string;
  team_member_id: string | null;
}

interface HouseholdRow {
  id: string;
  lead_source_id: string | null;
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

function emptyCell(): CrossTabCell {
  return { quotedHH: 0, soldHH: 0, premiumCents: 0, closeRate: null };
}

function computeCloseRate(cell: CrossTabCell): CrossTabCell {
  return {
    ...cell,
    closeRate: cell.quotedHH > 0 ? (cell.soldHH / cell.quotedHH) * 100 : null,
  };
}

export function useLqsProducerLeadSourceCrossTab(
  agencyId: string | null,
  dateRange: { start: Date; end: Date } | null
) {
  // Fetch lead sources
  const leadSourcesQuery = useQuery({
    queryKey: ['lqs-xtab-lead-sources', agencyId],
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
    queryKey: ['lqs-xtab-buckets', agencyId],
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
    queryKey: ['lqs-xtab-team-members', agencyId],
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

  // Fetch households (for lead_source_id mapping)
  const householdsQuery = useQuery({
    queryKey: ['lqs-xtab-households', agencyId],
    enabled: !!agencyId,
    staleTime: 30000,
    queryFn: async (): Promise<HouseholdRow[]> => {
      const allRows: HouseholdRow[] = [];
      for (let from = 0; from < MAX_FETCH; from += PAGE_SIZE) {
        const { data: page, error } = await supabase
          .from('lqs_households')
          .select('id, lead_source_id')
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

  // Fetch sales
  const salesQuery = useQuery({
    queryKey: ['lqs-xtab-sales', agencyId, dateRange?.start?.toISOString(), dateRange?.end?.toISOString()],
    enabled: !!agencyId,
    staleTime: 30000,
    queryFn: async (): Promise<SaleRow[]> => {
      const allRows: SaleRow[] = [];
      for (let from = 0; from < MAX_FETCH; from += PAGE_SIZE) {
        let query = supabase
          .from('lqs_sales')
          .select('household_id, team_member_id, premium_cents, policies_sold, items_sold')
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

  // Fetch quotes
  const quotesQuery = useQuery({
    queryKey: ['lqs-xtab-quotes', agencyId, dateRange?.start?.toISOString(), dateRange?.end?.toISOString()],
    enabled: !!agencyId,
    staleTime: 30000,
    queryFn: async (): Promise<QuoteRow[]> => {
      const allRows: QuoteRow[] = [];
      for (let from = 0; from < MAX_FETCH; from += PAGE_SIZE) {
        let query = supabase
          .from('lqs_quotes')
          .select('household_id, team_member_id')
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

  const buildCrossTab = useMemo(() => {
    return (aggregateByBucket: boolean): CrossTabData | null => {
      const leadSources = leadSourcesQuery.data;
      const buckets = bucketsQuery.data;
      const teamMembers = teamMembersQuery.data;
      const households = householdsQuery.data;
      const sales = salesQuery.data;
      const quotes = quotesQuery.data;

      if (!leadSources || !buckets || !teamMembers || !households || !sales || !quotes) return null;

      // Build lookup maps
      const householdSourceMap = new Map(households.map(h => [h.id, h.lead_source_id]));
      const sourceBucketMap = new Map(leadSources.map(ls => [ls.id, ls.bucket_id]));
      const sourceNameMap = new Map(leadSources.map(ls => [ls.id, ls.name]));
      const bucketNameMap = new Map(buckets.map(b => [b.id, b.name]));
      const teamMemberNameMap = new Map(teamMembers.map(tm => [tm.id, tm.name]));

      function getColumnId(leadSourceId: string | null): string {
        if (!leadSourceId) return '__unassigned__';
        if (aggregateByBucket) {
          const bucketId = sourceBucketMap.get(leadSourceId);
          return bucketId || '__unassigned__';
        }
        return leadSourceId;
      }

      // Determine columns
      const columnSet = new Set<string>();
      households.forEach(h => {
        columnSet.add(getColumnId(h.lead_source_id));
      });

      const columns: Array<{ id: string; name: string }> = [];
      if (aggregateByBucket) {
        buckets.forEach(b => {
          if (columnSet.has(b.id)) {
            columns.push({ id: b.id, name: b.name });
          }
        });
        if (columnSet.has('__unassigned__')) {
          columns.push({ id: '__unassigned__', name: 'Unassigned' });
        }
      } else {
        leadSources.forEach(ls => {
          if (columnSet.has(ls.id)) {
            columns.push({ id: ls.id, name: ls.name });
          }
        });
        if (columnSet.has('__unassigned__')) {
          columns.push({ id: '__unassigned__', name: 'Unassigned' });
        }
      }

      // Build matrix: producerId → columnId → cell
      const matrix = new Map<string, Map<string, CrossTabCell>>();

      function getOrCreateCell(producerKey: string, colId: string): CrossTabCell {
        if (!matrix.has(producerKey)) matrix.set(producerKey, new Map());
        const row = matrix.get(producerKey)!;
        if (!row.has(colId)) row.set(colId, emptyCell());
        return row.get(colId)!;
      }

      // Track unique quoted HH per producer+column
      const quotedHHSets = new Map<string, Set<string>>(); // "producerKey:colId" → set of HH ids
      const soldHHSets = new Map<string, Set<string>>();

      function getSetKey(producerKey: string, colId: string) {
        return `${producerKey}::${colId}`;
      }

      // Process quotes
      quotes.forEach(q => {
        const colId = getColumnId(householdSourceMap.get(q.household_id) ?? null);
        const producerKey = q.team_member_id ?? '__unassigned__';
        const setKey = getSetKey(producerKey, colId);
        if (!quotedHHSets.has(setKey)) quotedHHSets.set(setKey, new Set());
        quotedHHSets.get(setKey)!.add(q.household_id);
      });

      // Process sales
      sales.forEach(s => {
        const colId = getColumnId(householdSourceMap.get(s.household_id) ?? null);
        const producerKey = s.team_member_id ?? '__unassigned__';
        const setKey = getSetKey(producerKey, colId);
        if (!soldHHSets.has(setKey)) soldHHSets.set(setKey, new Set());
        soldHHSets.get(setKey)!.add(s.household_id);

        const cell = getOrCreateCell(producerKey, colId);
        cell.premiumCents += s.premium_cents || 0;
      });

      // Fill in HH counts
      quotedHHSets.forEach((hhSet, setKey) => {
        const [producerKey, colId] = setKey.split('::');
        const cell = getOrCreateCell(producerKey, colId);
        cell.quotedHH = hhSet.size;
      });
      soldHHSets.forEach((hhSet, setKey) => {
        const [producerKey, colId] = setKey.split('::');
        const cell = getOrCreateCell(producerKey, colId);
        cell.soldHH = hhSet.size;
      });

      // Build rows
      const rows: CrossTabRow[] = Array.from(matrix.entries()).map(([producerKey, cellMap]) => {
        const producerName = producerKey === '__unassigned__'
          ? 'Unassigned'
          : teamMemberNameMap.get(producerKey) || 'Unknown';

        const total = emptyCell();
        cellMap.forEach(cell => {
          total.quotedHH += cell.quotedHH;
          total.soldHH += cell.soldHH;
          total.premiumCents += cell.premiumCents;
        });

        // Compute close rates
        const cells = new Map<string, CrossTabCell>();
        cellMap.forEach((cell, colId) => {
          cells.set(colId, computeCloseRate(cell));
        });

        return {
          teamMemberId: producerKey === '__unassigned__' ? null : producerKey,
          producerName,
          cells,
          total: computeCloseRate(total),
        };
      }).sort((a, b) => b.total.premiumCents - a.total.premiumCents);

      // Column totals
      const columnTotals = new Map<string, CrossTabCell>();
      columns.forEach(col => {
        const total = emptyCell();
        rows.forEach(row => {
          const cell = row.cells.get(col.id);
          if (cell) {
            total.quotedHH += cell.quotedHH;
            total.soldHH += cell.soldHH;
            total.premiumCents += cell.premiumCents;
          }
        });
        columnTotals.set(col.id, computeCloseRate(total));
      });

      // Grand total
      const grandTotal = emptyCell();
      rows.forEach(row => {
        grandTotal.quotedHH += row.total.quotedHH;
        grandTotal.soldHH += row.total.soldHH;
        grandTotal.premiumCents += row.total.premiumCents;
      });

      return {
        rows,
        columns,
        columnTotals,
        grandTotal: computeCloseRate(grandTotal),
      };
    };
  }, [leadSourcesQuery.data, bucketsQuery.data, teamMembersQuery.data, householdsQuery.data, salesQuery.data, quotesQuery.data]);

  const isLoading = leadSourcesQuery.isLoading || bucketsQuery.isLoading || teamMembersQuery.isLoading
    || householdsQuery.isLoading || salesQuery.isLoading || quotesQuery.isLoading;
  const error = leadSourcesQuery.error || bucketsQuery.error || teamMembersQuery.error
    || householdsQuery.error || salesQuery.error || quotesQuery.error;

  return { buildCrossTab, isLoading, error };
}
