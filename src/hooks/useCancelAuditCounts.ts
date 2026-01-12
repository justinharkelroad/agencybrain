import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { callCancelAuditApi, getStaffSessionToken } from '@/lib/cancel-audit-api';

interface CancelAuditCounts {
  needsAttention: number;
  all: number;
  superseded: number;
  activeByType: {
    pending_cancel: number;
    cancellation: number;
  };
}

export function useCancelAuditCounts(agencyId: string | null) {
  const staffSessionToken = getStaffSessionToken();

  return useQuery({
    queryKey: ['cancel-audit-counts', agencyId],
    queryFn: async (): Promise<CancelAuditCounts> => {
      if (!agencyId) {
        return { needsAttention: 0, all: 0, superseded: 0, activeByType: { pending_cancel: 0, cancellation: 0 } };
      }

      // Staff portal: use edge function
      if (staffSessionToken) {
        return callCancelAuditApi({
          operation: "get_counts",
          params: {},
          sessionToken: staffSessionToken,
        });
      }

      // Regular auth: use direct Supabase query
      // Get needs attention count (active + new/in_progress)
      const { count: needsAttention, error: needsAttentionError } = await supabase
        .from('cancel_audit_records')
        .select('*', { count: 'exact', head: true })
        .eq('agency_id', agencyId)
        .eq('is_active', true)
        .in('status', ['new', 'in_progress']);

      if (needsAttentionError) throw needsAttentionError;

      // Get all records count
      const { count: all, error: allError } = await supabase
        .from('cancel_audit_records')
        .select('*', { count: 'exact', head: true })
        .eq('agency_id', agencyId);

      if (allError) throw allError;

      // Get superseded (not current) records count
      const { count: superseded, error: supersededError } = await supabase
        .from('cancel_audit_records')
        .select('*', { count: 'exact', head: true })
        .eq('agency_id', agencyId)
        .eq('is_active', false);

      if (supersededError) throw supersededError;

      // Get active pending cancel count
      const { count: pendingCancel, error: pendingError } = await supabase
        .from('cancel_audit_records')
        .select('*', { count: 'exact', head: true })
        .eq('agency_id', agencyId)
        .eq('is_active', true)
        .eq('report_type', 'pending_cancel')
        .in('status', ['new', 'in_progress']);

      if (pendingError) throw pendingError;

      // Get active cancellation count
      const { count: cancellation, error: cancellationError } = await supabase
        .from('cancel_audit_records')
        .select('*', { count: 'exact', head: true })
        .eq('agency_id', agencyId)
        .eq('is_active', true)
        .eq('report_type', 'cancellation')
        .in('status', ['new', 'in_progress']);

      if (cancellationError) throw cancellationError;

      return {
        needsAttention: needsAttention || 0,
        all: all || 0,
        superseded: superseded || 0,
        activeByType: {
          pending_cancel: pendingCancel || 0,
          cancellation: cancellation || 0,
        },
      };
    },
    enabled: !!agencyId,
    staleTime: 30000,
  });
}
