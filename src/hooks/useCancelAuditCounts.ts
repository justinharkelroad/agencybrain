import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface CancelAuditCounts {
  needsAttention: number;
  all: number;
  activeByType: {
    pending_cancel: number;
    cancellation: number;
  };
}

export function useCancelAuditCounts(agencyId: string | null) {
  return useQuery({
    queryKey: ['cancel-audit-counts', agencyId],
    queryFn: async (): Promise<CancelAuditCounts> => {
      if (!agencyId) {
        return { needsAttention: 0, all: 0, activeByType: { pending_cancel: 0, cancellation: 0 } };
      }

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
