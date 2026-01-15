import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { callCancelAuditApi, getStaffSessionToken } from '@/lib/cancel-audit-api';
import { toast } from 'sonner';
import type { RecordStatus } from '@/types/cancel-audit';

/**
 * Hook for bulk updating cancel audit record statuses.
 * Supports both agency portal (direct Supabase) and staff portal (edge function).
 */
export function useBulkUpdateCancelAuditStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ recordIds, status }: { recordIds: string[]; status: RecordStatus }) => {
      const staffSessionToken = getStaffSessionToken();

      if (staffSessionToken) {
        // Staff portal: use edge function to bypass RLS
        console.log('[useBulkUpdateCancelAuditStatus] Staff user, calling edge function');
        const result = await callCancelAuditApi({
          operation: 'bulk_update_status',
          params: { recordIds, status },
          sessionToken: staffSessionToken,
        });
        
        if (result.error) {
          throw new Error(result.error);
        }
        
        return { count: result.count || recordIds.length, status };
      }

      // Agency portal: direct Supabase update (RLS handles access)
      console.log('[useBulkUpdateCancelAuditStatus] Agency user, direct Supabase call');
      const { error } = await supabase
        .from('cancel_audit_records')
        .update({ status, updated_at: new Date().toISOString() })
        .in('id', recordIds);

      if (error) throw error;
      return { count: recordIds.length, status };
    },
    onSuccess: ({ count, status }) => {
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ['cancel-audit-records'] });
      queryClient.invalidateQueries({ queryKey: ['cancel-audit-stats'] });
      queryClient.invalidateQueries({ queryKey: ['cancel-audit-counts'] });
      queryClient.invalidateQueries({ queryKey: ['cancel-audit-activity-summary'] });
      // Invalidate Hero Stats queries
      queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          typeof query.queryKey[0] === 'string' &&
          query.queryKey[0].startsWith('cancel-audit-hero-')
      });
      
      const statusLabel = status.replace('_', ' ');
      toast.success(`Updated ${count} record${count > 1 ? 's' : ''} to ${statusLabel}`);
    },
    onError: (error) => {
      console.error('[useBulkUpdateCancelAuditStatus] Error:', error);
      toast.error('Failed to update records');
    },
  });
}
