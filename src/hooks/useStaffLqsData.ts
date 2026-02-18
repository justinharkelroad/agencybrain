import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { HouseholdWithRelations, LqsMetrics, LqsLeadSource } from './useLqsData';
import { LqsObjection } from './useLqsObjections';

interface UseStaffLqsDataParams {
  sessionToken: string | null;
  dateRange?: { start: Date; end: Date } | null;
  statusFilter?: string;
  searchTerm?: string;
}

interface StaffLqsDataResponse {
  households: HouseholdWithRelations[];
  metrics: LqsMetrics;
  lead_sources: LqsLeadSource[];
  team_members: { id: string; name: string; email: string }[];
  team_member_id: string | null;
  agency_id: string;
}

export function useStaffLqsData({ sessionToken, dateRange, statusFilter, searchTerm }: UseStaffLqsDataParams) {
  return useQuery({
    queryKey: ['staff-lqs-data', sessionToken, dateRange?.start?.toISOString(), dateRange?.end?.toISOString(), statusFilter, searchTerm],
    enabled: !!sessionToken,
    queryFn: async (): Promise<{ households: HouseholdWithRelations[]; metrics: LqsMetrics }> => {
      const { data, error } = await supabase.functions.invoke('get_staff_lqs_data', {
        headers: {
          'x-staff-session': sessionToken!,
        },
        body: {
          date_start: dateRange?.start?.toISOString().split('T')[0],
          date_end: dateRange?.end?.toISOString().split('T')[0],
          status_filter: statusFilter,
          search_term: searchTerm,
        },
      });

      if (error) {
        console.error('Error fetching staff LQS data:', error);
        throw error;
      }

      if (data?.error) {
        console.error('Staff LQS data error:', data.error);
        throw new Error(data.error);
      }

      return {
        households: data.households || [],
        metrics: data.metrics || {
          totalQuotes: 0,
          selfGenerated: 0,
          sold: 0,
          needsAttention: 0,
          leadsCount: 0,
          quotedCount: 0,
          soldCount: 0,
          leadsToQuotedRate: 0,
          quotedToSoldRate: 0,
          totalPremiumQuotedCents: 0,
          totalPremiumSoldCents: 0,
          avgPremiumSoldCents: 0,
          quotedNeedsAttention: 0,
          soldNeedsAttention: 0,
        },
      };
    },
  });
}

export function useStaffLqsLeadSources(sessionToken: string | null) {
  return useQuery({
    queryKey: ['staff-lqs-lead-sources', sessionToken],
    enabled: !!sessionToken,
    queryFn: async (): Promise<LqsLeadSource[]> => {
      const { data, error } = await supabase.functions.invoke('get_staff_lqs_data', {
        headers: {
          'x-staff-session': sessionToken!,
        },
        body: {},
      });

      if (error) {
        console.error('Error fetching staff lead sources:', error);
        throw error;
      }

      return data?.lead_sources || [];
    },
  });
}

export function useStaffLqsTeamMembers(sessionToken: string | null) {
  return useQuery({
    queryKey: ['staff-lqs-team-members', sessionToken],
    enabled: !!sessionToken,
    queryFn: async (): Promise<{ id: string; name: string; email: string }[]> => {
      const { data, error } = await supabase.functions.invoke('get_staff_lqs_data', {
        headers: {
          'x-staff-session': sessionToken!,
        },
        body: {},
      });

      if (error) {
        console.error('Error fetching staff team members:', error);
        throw error;
      }

      return data?.team_members || [];
    },
  });
}

export function useStaffLqsObjections(sessionToken: string | null) {
  return useQuery({
    queryKey: ['staff-lqs-objections', sessionToken],
    enabled: !!sessionToken,
    queryFn: async (): Promise<LqsObjection[]> => {
      const { data, error } = await supabase.functions.invoke('get_staff_lqs_data', {
        headers: {
          'x-staff-session': sessionToken!,
        },
        body: {},
      });

      if (error) {
        console.error('Error fetching staff objections:', error);
        throw error;
      }

      return data?.objections || [];
    },
  });
}

export function useStaffAssignLeadSource(sessionToken: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      householdId,
      leadSourceId,
    }: {
      householdId: string;
      leadSourceId: string;
    }) => {
      if (!sessionToken) throw new Error('No staff session');

      const { data, error } = await supabase.functions.invoke('staff_assign_lead_source', {
        headers: {
          'x-staff-session': sessionToken,
        },
        body: {
          household_id: householdId,
          lead_source_id: leadSourceId,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-lqs-data'] });
    },
  });
}

export function useStaffBulkAssignLeadSource(sessionToken: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      householdIds,
      leadSourceId,
    }: {
      householdIds: string[];
      leadSourceId: string;
    }) => {
      if (!sessionToken) throw new Error('No staff session');

      const { data, error } = await supabase.functions.invoke('staff_assign_lead_source', {
        headers: {
          'x-staff-session': sessionToken,
        },
        body: {
          household_ids: householdIds,
          lead_source_id: leadSourceId,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return { updated: householdIds.length };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-lqs-data'] });
    },
  });
}
