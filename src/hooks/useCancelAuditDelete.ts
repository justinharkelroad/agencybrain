import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useBulkDeleteCancelAuditRecords() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (recordIds: string[]) => {
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
      toast.success(`${count} record${count > 1 ? 's' : ''} deleted`);
    },
    onError: () => {
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
      toast.success('All cancel audit data deleted');
    },
    onError: () => {
      toast.error('Failed to delete cancel audit data');
    },
  });
}
