import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { LqsHousehold, LqsQuote } from '@/types/lqs';

// Extended types with relations
export interface LqsLeadSource {
  id: string;
  name: string;
  is_self_generated: boolean;
  bucket?: { id: string; name: string } | null;
}

export interface LqsTeamMember {
  id: string;
  name: string;
}

export interface LqsSaleRecord {
  id: string;
  sale_date: string;
  product_type: string;
  items_sold: number;
  policies_sold: number;
  premium_cents: number;
  policy_number: string | null;
  source: string;
  source_reference_id: string | null;
  linked_quote_id: string | null;
}

export interface HouseholdWithRelations extends LqsHousehold {
  quotes: LqsQuote[];
  sales: LqsSaleRecord[];
  lead_source: LqsLeadSource | null;
  team_member: LqsTeamMember | null;
}

export interface LqsMetrics {
  totalQuotes: number;
  selfGenerated: number;
  sold: number;
  needsAttention: number;
}

interface UseLqsDataParams {
  agencyId: string | null;
  dateRange?: { start: Date; end: Date } | null;
  statusFilter?: string;
  searchTerm?: string;
}

export function useLqsData({ agencyId, dateRange, statusFilter, searchTerm }: UseLqsDataParams) {
  return useQuery({
    queryKey: ['lqs-data', agencyId, dateRange?.start?.toISOString(), dateRange?.end?.toISOString(), statusFilter, searchTerm],
    enabled: !!agencyId,
    queryFn: async () => {
      // Fetch households with quotes
      let query = supabase
        .from('lqs_households')
        .select(`
          *,
          quotes:lqs_quotes(*),
          sales:lqs_sales(*),
          lead_source:lead_sources(id, name, is_self_generated, bucket:marketing_buckets(id, name)),
          team_member:team_members(id, name)
        `)
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false });

      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (searchTerm) {
        query = query.or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Cast to proper type
      const households = (data || []) as unknown as HouseholdWithRelations[];

      // Filter by date range if provided (on quotes.quote_date)
      let filteredHouseholds = households;
      if (dateRange?.start && dateRange?.end) {
        const startDate = dateRange.start.toISOString().split('T')[0];
        const endDate = dateRange.end.toISOString().split('T')[0];
        filteredHouseholds = households.filter(h => 
          h.quotes?.some(q => q.quote_date >= startDate && q.quote_date <= endDate)
        );
      }

      // Calculate metrics
      const metrics: LqsMetrics = {
        totalQuotes: filteredHouseholds.reduce((sum, h) => sum + (h.quotes?.length || 0), 0),
        selfGenerated: filteredHouseholds.filter(h => h.lead_source?.is_self_generated === true).length,
        sold: filteredHouseholds.filter(h => h.status === 'sold').length,
        needsAttention: filteredHouseholds.filter(h => h.needs_attention).length,
      };

      return { households: filteredHouseholds, metrics };
    },
  });
}

// Fetch lead sources for assignment modal
export function useLqsLeadSources(agencyId: string | null) {
  return useQuery({
    queryKey: ['lqs-lead-sources', agencyId],
    enabled: !!agencyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_sources')
        .select(`
          id, 
          name, 
          is_self_generated,
          bucket:marketing_buckets(id, name)
        `)
        .eq('agency_id', agencyId!)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return (data || []) as LqsLeadSource[];
    },
  });
}

export function useAssignLeadSource() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      householdId,
      leadSourceId,
    }: {
      householdId: string;
      leadSourceId: string;
    }) => {
      const { error } = await supabase
        .from('lqs_households')
        .update({
          lead_source_id: leadSourceId,
          needs_attention: false, // Always false when source is assigned
        })
        .eq('id', householdId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lqs-data'] });
    },
  });
}

// Bulk assign lead source to multiple households
export function useBulkAssignLeadSource() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      householdIds,
      leadSourceId,
    }: {
      householdIds: string[];
      leadSourceId: string;
    }) => {
      const { error } = await supabase
        .from('lqs_households')
        .update({
          lead_source_id: leadSourceId,
          needs_attention: false,
        })
        .in('id', householdIds);

      if (error) throw error;
      return { updated: householdIds.length };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lqs-data'] });
    },
  });
}
