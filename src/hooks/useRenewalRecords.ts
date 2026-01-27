import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getStaffSessionToken } from '@/lib/cancel-audit-api';
import { sendRenewalToWinback } from '@/lib/sendToWinback';
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

export interface RenewalRecordsResult {
  records: RenewalRecord[];
  totalCount: number;
}

export function useRenewalRecords(
  agencyId: string | null, 
  filters: RenewalFilters = {},
  page: number = 1,
  pageSize: number = 50
) {
  const staffSessionToken = getStaffSessionToken();
  
  return useQuery({
    queryKey: ['renewal-records', agencyId, filters, page, pageSize, !!staffSessionToken],
    queryFn: async (): Promise<RenewalRecordsResult> => {
      if (!agencyId) return { records: [], totalCount: 0 };
      
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      
      // Staff users: call edge function to bypass RLS
      if (staffSessionToken) {
        console.log('[useRenewalRecords] Staff user detected, calling edge function with pagination:', { page, pageSize });
        const { data, error } = await supabase.functions.invoke('get_staff_renewals', {
          body: { 
            page,
            pageSize,
            filters: {
              currentStatus: filters.currentStatus,
              renewalStatus: filters.renewalStatus,
              productName: filters.productName,
              bundledStatus: filters.bundledStatus,
              accountType: filters.accountType,
              assignedTeamMemberId: filters.assignedTeamMemberId,
              dateRange: filters.dateRangeStart || filters.dateRangeEnd ? {
                start: filters.dateRangeStart,
                end: filters.dateRangeEnd
              } : undefined,
              searchQuery: filters.search
            }
          },
          headers: { 'x-staff-session': staffSessionToken }
        });
        
        if (error) {
          console.error('[useRenewalRecords] Edge function error:', error);
          throw error;
        }
        
        console.log('[useRenewalRecords] Got records from edge function:', data?.records?.length, 'of', data?.totalCount);
        return { 
          records: (data?.records || []) as RenewalRecord[], 
          totalCount: data?.totalCount || 0 
        };
      }
      
      // Regular users: direct query (RLS handles access)
      let query = supabase
        .from('renewal_records')
        .select(`*, assigned_team_member:team_members!renewal_records_assigned_team_member_id_fkey(id, name)`, { count: 'exact' })
        .eq('agency_id', agencyId)
        .eq('is_active', true)
        .order('renewal_effective_date', { ascending: true })
        .order('id', { ascending: true }) // Stable tie-breaker to prevent reorder on refetch
        .range(from, to);
      
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
      
      const { data, error, count } = await query;
      if (error) throw error;
      return { records: data as RenewalRecord[], totalCount: count || 0 };
    },
    enabled: !!agencyId,
  });
}

export function useRenewalStats(agencyId: string | null, dateRange?: { start: string; end: string }) {
  const staffSessionToken = getStaffSessionToken();
  
  return useQuery({
    queryKey: ['renewal-stats', agencyId, dateRange, !!staffSessionToken],
    queryFn: async () => {
      if (!agencyId) return null;
      
      // Staff users: call edge function to bypass RLS
      if (staffSessionToken) {
        console.log('[useRenewalStats] Staff user detected, calling edge function');
        const { data, error } = await supabase.functions.invoke('get_staff_renewal_stats', {
          body: { dateRange },
          headers: { 'x-staff-session': staffSessionToken }
        });
        
        if (error) {
          console.error('[useRenewalStats] Edge function error:', error);
          throw error;
        }
        
        return data?.stats || null;
      }
      
      // Regular users: direct query
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
    mutationFn: async ({ id, updates, displayName, userId, silent, invalidate, invalidateStats, sendToWinback }: {
      id: string;
      updates: Partial<Pick<RenewalRecord, 'current_status' | 'notes' | 'assigned_team_member_id' | 'is_priority'>>;
      displayName: string;
      userId: string | null;
      silent?: boolean;
      invalidate?: boolean;
      invalidateStats?: boolean;
      sendToWinback?: boolean;
    }) => {
      const staffSessionToken = getStaffSessionToken();
      
      // Staff portal: use edge function
      if (staffSessionToken) {
        const { data, error } = await supabase.functions.invoke('get_staff_renewals', {
          body: { 
            operation: 'update_record',
            params: { id, updates, displayName, userId, sendToWinback }
          },
          headers: { 'x-staff-session': staffSessionToken }
        });
        
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        return { id, updates, silent, invalidate, invalidateStats, winbackResult: data?.winbackResult };
      }
      
      // Regular auth: direct Supabase update
      const { error } = await supabase.from('renewal_records').update({
        ...updates,
        last_activity_at: new Date().toISOString(),
        last_activity_by: userId,
        last_activity_by_display_name: displayName,
        updated_at: new Date().toISOString(),
      }).eq('id', id);
      if (error) throw error;
      return { id, updates, silent, invalidate, invalidateStats };
    },
    onMutate: async ({ id, updates }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['renewal-records'] });
      
      // Snapshot previous value
      const previousRecords = queryClient.getQueryData<RenewalRecord[]>(['renewal-records']);
      
      // Optimistically update the cache
      queryClient.setQueriesData<RenewalRecord[]>(
        { queryKey: ['renewal-records'] },
        (old) => old?.map(r => r.id === id ? { ...r, ...updates } : r)
      );
      
      return { previousRecords };
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
    onError: (_, variables, context) => {
      // Roll back on error
      if (context?.previousRecords) {
        queryClient.setQueriesData({ queryKey: ['renewal-records'] }, context.previousRecords);
      }
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
      const staffSessionToken = getStaffSessionToken();
      const isUnsuccessful = updates.current_status === 'unsuccessful';
      
      if (staffSessionToken) {
        // Staff portal: use edge function to bypass RLS
        console.log('[useBulkUpdateRenewals] Staff user, calling edge function');
        const { data, error } = await supabase.functions.invoke('get_staff_renewals', {
          body: { 
            operation: 'bulk_update_records',
            params: { ids, updates, displayName, userId, sendToWinback: isUnsuccessful }
          },
          headers: { 'x-staff-session': staffSessionToken }
        });
        
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        return { count: data?.count || ids.length, winbackCount: data?.winbackCount || 0 };
      }
      
      // Agency portal: direct Supabase update (RLS handles access)
      console.log('[useBulkUpdateRenewals] Agency user, direct Supabase call');
      const { error } = await supabase.from('renewal_records').update({
        ...updates,
        last_activity_at: new Date().toISOString(),
        last_activity_by: userId,
        last_activity_by_display_name: displayName,
        updated_at: new Date().toISOString(),
      }).in('id', ids);
      if (error) throw error;
      
      // If updating to unsuccessful, also send to Winback
      let winbackCount = 0;
      if (isUnsuccessful) {
        console.log('[useBulkUpdateRenewals] Status is unsuccessful, sending to Winback...');
        
        // Fetch full record details for winback
        const { data: records, error: fetchError } = await supabase
          .from('renewal_records')
          .select('id, agency_id, first_name, last_name, email, phone, policy_number, product_name, renewal_effective_date, premium_old, premium_new, agent_number, household_key')
          .in('id', ids);
        
        if (fetchError) {
          console.error('[useBulkUpdateRenewals] Failed to fetch records for winback:', fetchError);
        } else if (records) {
          // Send each record to winback
          for (const record of records) {
            try {
              const result = await sendRenewalToWinback(record);
              if (result.success) {
                winbackCount++;
              } else {
                console.warn(`[useBulkUpdateRenewals] Failed to send ${record.policy_number} to winback:`, result.error);
              }
            } catch (err) {
              console.error(`[useBulkUpdateRenewals] Error sending ${record.policy_number} to winback:`, err);
            }
          }
        }
      }
      
      return { count: ids.length, winbackCount };
    },
    onSuccess: (result, { ids, updates }) => {
      queryClient.invalidateQueries({ queryKey: ['renewal-records'] });
      queryClient.invalidateQueries({ queryKey: ['renewal-stats'] });
      
      if (updates.current_status === 'unsuccessful' && result.winbackCount > 0) {
        queryClient.invalidateQueries({ queryKey: ['winback-households'] });
        toast.success(`${ids.length} records updated, ${result.winbackCount} sent to Win-Back HQ`);
      } else {
        toast.success(`${ids.length} records updated`);
      }
    },
    onError: (error) => {
      console.error('[useBulkUpdateRenewals] Error:', error);
      toast.error('Failed to update records');
    },
  });
}

export function useBulkDeleteRenewals() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const staffSessionToken = getStaffSessionToken();
      
      if (staffSessionToken) {
        // Staff portal: use edge function to bypass RLS
        console.log('[useBulkDeleteRenewals] Staff user, calling edge function');
        const { data, error } = await supabase.functions.invoke('get_staff_renewals', {
          body: { 
            operation: 'bulk_delete_records',
            params: { ids }
          },
          headers: { 'x-staff-session': staffSessionToken }
        });
        
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        return ids.length;
      }
      
      // Agency portal: direct Supabase delete (RLS handles access)
      console.log('[useBulkDeleteRenewals] Agency user, direct Supabase call');
      
      // Batch size to avoid URL length limits (Supabase .in() encodes IDs in URL)
      const BATCH_SIZE = 50;
      
      // Process deletions in batches
      for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        const batch = ids.slice(i, i + BATCH_SIZE);
        
        // First delete any associated activities for this batch
        const { error: activitiesError } = await supabase
          .from('renewal_activities')
          .delete()
          .in('renewal_record_id', batch);
        
        if (activitiesError) {
          console.error(`[useBulkDeleteRenewals] Failed to delete activities batch ${i / BATCH_SIZE + 1}:`, activitiesError);
          throw activitiesError;
        }
        
        // Then hard delete the records for this batch
        const { error } = await supabase
          .from('renewal_records')
          .delete()
          .in('id', batch);
        
        if (error) {
          console.error(`[useBulkDeleteRenewals] Failed to delete records batch ${i / BATCH_SIZE + 1}:`, error);
          throw error;
        }
      }
      
      return ids.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['renewal-records'] });
      queryClient.invalidateQueries({ queryKey: ['renewal-stats'] });
      queryClient.invalidateQueries({ queryKey: ['renewal-uploads'] });
      toast.success(`${count} records deleted`);
    },
    onError: (error) => {
      console.error('[useBulkDeleteRenewals] Bulk delete failed:', error);
      toast.error('Failed to delete records');
    },
  });
}

export function useDeleteAllRenewalData() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (agencyId: string) => {
      // Delete in order: activities -> records -> uploads
      const { error: activitiesError } = await supabase
        .from('renewal_activities')
        .delete()
        .eq('agency_id', agencyId);

      if (activitiesError) throw activitiesError;

      const { error: recordsError } = await supabase
        .from('renewal_records')
        .delete()
        .eq('agency_id', agencyId);

      if (recordsError) throw recordsError;

      const { error: uploadsError } = await supabase
        .from('renewal_uploads')
        .delete()
        .eq('agency_id', agencyId);

      if (uploadsError) throw uploadsError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['renewal-records'] });
      queryClient.invalidateQueries({ queryKey: ['renewal-stats'] });
      queryClient.invalidateQueries({ queryKey: ['renewal-uploads'] });
      toast.success('All renewal data deleted');
    },
    onError: (error) => {
      console.error('[useDeleteAllRenewalData] Delete all failed:', error);
      toast.error('Failed to delete renewal data');
    },
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
