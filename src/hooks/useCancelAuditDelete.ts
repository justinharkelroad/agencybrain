import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { callCancelAuditApi, getStaffSessionToken } from '@/lib/cancel-audit-api';
import { toast } from 'sonner';

export function useBulkDeleteCancelAuditRecords() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (recordIds: string[]) => {
      const staffSessionToken = getStaffSessionToken();

      if (staffSessionToken) {
        // Staff portal: use edge function to bypass RLS
        console.log('[useBulkDeleteCancelAuditRecords] Staff user, calling edge function');
        const result = await callCancelAuditApi({
          operation: 'bulk_delete_records',
          params: { recordIds },
          sessionToken: staffSessionToken,
        });
        
        if (result.error) {
          throw new Error(result.error);
        }
        
        return result.count || recordIds.length;
      }

      // Agency portal: direct Supabase delete (RLS handles access)
      console.log('[useBulkDeleteCancelAuditRecords] Agency user, direct Supabase call');
      
      // First delete all activities for these records
      const { error: activitiesError } = await supabase
        .from('cancel_audit_activities')
        .delete()
        .in('record_id', recordIds);

      if (activitiesError) throw activitiesError;

      // Then delete the records themselves
      const { error: recordsError } = await supabase
        .from('cancel_audit_records')
        .delete()
        .in('id', recordIds);

      if (recordsError) throw recordsError;

      return recordIds.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['cancel-audit-records'] });
      queryClient.invalidateQueries({ queryKey: ['cancel-audit-stats'] });
      queryClient.invalidateQueries({ queryKey: ['cancel-audit-counts'] });
      queryClient.invalidateQueries({ queryKey: ['cancel-audit-uploads'] });
      queryClient.invalidateQueries({ queryKey: ['cancel-audit-activity-summary'] });
      // Invalidate Hero Stats queries
      queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          typeof query.queryKey[0] === 'string' &&
          query.queryKey[0].startsWith('cancel-audit-hero-')
      });
      toast.success(`${count} record${count > 1 ? 's' : ''} deleted`);
    },
    onError: (error) => {
      console.error('[useBulkDeleteCancelAuditRecords] Error:', error);
      toast.error('Failed to delete records');
    },
  });
}

export function useDeleteAllCancelAuditData() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (agencyId: string) => {
      // Delete in order: activities -> records -> uploads
      const { error: activitiesError } = await supabase
        .from('cancel_audit_activities')
        .delete()
        .eq('agency_id', agencyId);

      if (activitiesError) throw activitiesError;

      const { error: recordsError } = await supabase
        .from('cancel_audit_records')
        .delete()
        .eq('agency_id', agencyId);

      if (recordsError) throw recordsError;

      const { error: uploadsError } = await supabase
        .from('cancel_audit_uploads')
        .delete()
        .eq('agency_id', agencyId);

      if (uploadsError) throw uploadsError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cancel-audit-records'] });
      queryClient.invalidateQueries({ queryKey: ['cancel-audit-stats'] });
      queryClient.invalidateQueries({ queryKey: ['cancel-audit-counts'] });
      queryClient.invalidateQueries({ queryKey: ['cancel-audit-uploads'] });
      queryClient.invalidateQueries({ queryKey: ['cancel-audit-activity-summary'] });
      // Invalidate Hero Stats queries
      queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          typeof query.queryKey[0] === 'string' &&
          query.queryKey[0].startsWith('cancel-audit-hero-')
      });
      toast.success('All cancel audit data deleted');
    },
    onError: () => {
      toast.error('Failed to delete cancel audit data');
    },
  });
}
