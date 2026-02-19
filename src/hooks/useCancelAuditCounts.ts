import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { callCancelAuditApi, getStaffSessionToken } from '@/lib/cancel-audit-api';

interface CancelAuditCounts {
  needsAttention: number;
  all: number;
  superseded: number;
  droppedUnresolved: number;
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
        return { needsAttention: 0, all: 0, superseded: 0, droppedUnresolved: 0, activeByType: { pending_cancel: 0, cancellation: 0 } };
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
      // Get needs attention count (new/in_progress regardless of is_active)
      const { count: needsAttention, error: needsAttentionError } = await supabase
        .from('cancel_audit_records')
        .select('*', { count: 'exact', head: true })
        .eq('agency_id', agencyId)
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

      // Get dropped but unresolved count (dropped from report but still needs work)
      const { count: droppedUnresolved, error: droppedError } = await supabase
        .from('cancel_audit_records')
        .select('*', { count: 'exact', head: true })
        .eq('agency_id', agencyId)
        .eq('is_active', false)
        .in('status', ['new', 'in_progress']);

      if (droppedError) throw droppedError;

      // Get pending cancel count (new/in_progress)
      const { count: pendingCancel, error: pendingError } = await supabase
        .from('cancel_audit_records')
        .select('*', { count: 'exact', head: true })
        .eq('agency_id', agencyId)
        .eq('report_type', 'pending_cancel')
        .in('status', ['new', 'in_progress']);

      if (pendingError) throw pendingError;

      // Get cancellation count (new/in_progress)
      const { count: cancellation, error: cancellationError } = await supabase
        .from('cancel_audit_records')
        .select('*', { count: 'exact', head: true })
        .eq('agency_id', agencyId)
        .eq('report_type', 'cancellation')
        .in('status', ['new', 'in_progress']);

      if (cancellationError) throw cancellationError;

      return {
        needsAttention: needsAttention || 0,
        all: all || 0,
        superseded: superseded || 0,
        droppedUnresolved: droppedUnresolved || 0,
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
