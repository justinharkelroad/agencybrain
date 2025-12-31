import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getStaffSessionToken } from '@/lib/cancel-audit-api';
import { toast } from 'sonner';
import type { RenewalRecord, WorkflowStatus } from '@/types/renewal';

export interface RenewalFilters {
  currentStatus?: WorkflowStatus[];
  renewalStatus?: string[];
  productName?: string[];
  bundledStatus?: 'all' | 'bundled' | 'monoline';
  accountType?: string[];
  assignedTeamMemberId?: string | 'unassigned';
  dateRangeStart?: string;
  dateRangeEnd?: string;
  search?: string;
}

export function useRenewalRecords(agencyId: string | null, filters: RenewalFilters = {}) {
  return useQuery({
    queryKey: ['renewal-records', agencyId, filters],
    queryFn: async () => {
      if (!agencyId) return [];
      if (getStaffSessionToken()) throw new Error('Staff portal data access coming in Phase 3');
      
      let query = supabase
        .from('renewal_records')
        .select(`*, assigned_team_member:team_members!renewal_records_assigned_team_member_id_fkey(id, name)`)
        .eq('agency_id', agencyId)
        .eq('is_active', true)
        .order('renewal_effective_date', { ascending: true })
        .order('id', { ascending: true }); // Stable tie-breaker to prevent reorder on refetch
      
      if (filters.currentStatus?.length) query = query.in('current_status', filters.currentStatus);
      if (filters.renewalStatus?.length) query = query.in('renewal_status', filters.renewalStatus);
      if (filters.productName?.length) query = query.in('product_name', filters.productName);
      if (filters.bundledStatus === 'bundled') query = query.eq('multi_line_indicator', true);
      else if (filters.bundledStatus === 'monoline') query = query.eq('multi_line_indicator', false);
      if (filters.accountType?.length) query = query.in('account_type', filters.accountType);
      if (filters.assignedTeamMemberId) {
        if (filters.assignedTeamMemberId === 'unassigned') query = query.is('assigned_team_member_id', null);
        else query = query.eq('assigned_team_member_id', filters.assignedTeamMemberId);
      }
      if (filters.dateRangeStart) query = query.gte('renewal_effective_date', filters.dateRangeStart);
      if (filters.dateRangeEnd) query = query.lte('renewal_effective_date', filters.dateRangeEnd);
      if (filters.search) {
        query = query.or(`first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,policy_number.ilike.%${filters.search}%,email.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as RenewalRecord[];
    },
    enabled: !!agencyId,
  });
}

export function useRenewalStats(agencyId: string | null, dateRange?: { start: string; end: string }) {
  return useQuery({
    queryKey: ['renewal-stats', agencyId, dateRange],
    queryFn: async () => {
      if (!agencyId) return null;
      let query = supabase
        .from('renewal_records')
        .select('current_status, multi_line_indicator')
        .eq('agency_id', agencyId)
        .eq('is_active', true);
      
      if (dateRange?.start) query = query.gte('renewal_effective_date', dateRange.start);
      if (dateRange?.end) query = query.lte('renewal_effective_date', dateRange.end);
      
      const { data, error } = await query;
      if (error) throw error;
      
      return {
        total: data.length,
        uncontacted: data.filter(r => r.current_status === 'uncontacted').length,
        pending: data.filter(r => r.current_status === 'pending').length,
        success: data.filter(r => r.current_status === 'success').length,
        unsuccessful: data.filter(r => r.current_status === 'unsuccessful').length,
        bundled: data.filter(r => r.multi_line_indicator).length,
        monoline: data.filter(r => !r.multi_line_indicator).length,
      };
    },
    enabled: !!agencyId,
  });
}

export function useUpdateRenewalRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates, displayName, userId, silent, invalidate, invalidateStats }: {
      id: string;
      updates: Partial<Pick<RenewalRecord, 'current_status' | 'notes' | 'assigned_team_member_id' | 'is_priority'>>;
      displayName: string;
      userId: string | null;
      silent?: boolean;
      invalidate?: boolean;
      invalidateStats?: boolean;
    }) => {
      const { error } = await supabase.from('renewal_records').update({
        ...updates,
        last_activity_at: new Date().toISOString(),
        last_activity_by: userId,
        last_activity_by_display_name: displayName,
        updated_at: new Date().toISOString(),
      }).eq('id', id);
      if (error) throw error;
      return { silent, invalidate, invalidateStats };
    },
    onSuccess: (result) => {
      if (result?.invalidate !== false) {
        queryClient.invalidateQueries({ queryKey: ['renewal-records'] });
      }
      if (result?.invalidateStats !== false) {
        queryClient.invalidateQueries({ queryKey: ['renewal-stats'] });
      }
      if (!result?.silent) {
        toast.success('Record updated');
      }
    },
    onError: (_, variables) => {
      if (!variables.silent) {
        toast.error('Failed to update record');
      }
    },
  });
}

export function useBulkUpdateRenewals() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, updates, displayName, userId }: {
      ids: string[];
      updates: Partial<Pick<RenewalRecord, 'current_status' | 'assigned_team_member_id'>>;
      displayName: string;
      userId: string | null;
    }) => {
      const { error } = await supabase.from('renewal_records').update({
        ...updates,
        last_activity_at: new Date().toISOString(),
        last_activity_by: userId,
        last_activity_by_display_name: displayName,
        updated_at: new Date().toISOString(),
      }).in('id', ids);
      if (error) throw error;
    },
    onSuccess: (_, { ids }) => {
      queryClient.invalidateQueries({ queryKey: ['renewal-records'] });
      queryClient.invalidateQueries({ queryKey: ['renewal-stats'] });
      toast.success(`${ids.length} records updated`);
    },
    onError: () => toast.error('Failed to update records'),
  });
}

export function useBulkDeleteRenewals() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('renewal_records')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .in('id', ids);
      if (error) throw error;
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ['renewal-records'] });
      queryClient.invalidateQueries({ queryKey: ['renewal-stats'] });
      toast.success(`${ids.length} records removed`);
    },
    onError: () => toast.error('Failed to delete records'),
  });
}

export function useRenewalProductNames(agencyId: string | null) {
  return useQuery({
    queryKey: ['renewal-product-names', agencyId],
    queryFn: async () => {
      if (!agencyId) return [];
      const { data, error } = await supabase.from('renewal_records')
        .select('product_name')
        .eq('agency_id', agencyId)
        .eq('is_active', true)
        .not('product_name', 'is', null);
      if (error) throw error;
      return [...new Set(data.map(r => r.product_name))].filter(Boolean).sort() as string[];
    },
    enabled: !!agencyId,
  });
}
