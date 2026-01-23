import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { callCancelAuditApi, getStaffSessionToken } from '@/lib/cancel-audit-api';

/**
 * Hook to fetch policy numbers currently in active cancel audit (new/in_progress).
 * Returns a Set<string> for O(1) lookup when filtering renewals.
 */
export function useActiveCancelAuditPolicies(agencyId: string | null) {
  const staffSessionToken = getStaffSessionToken();

  return useQuery({
    queryKey: ['active-cancel-audit-policies', agencyId],
    queryFn: async (): Promise<Set<string>> => {
      if (!agencyId) {
        return new Set();
      }

      // Staff portal: use edge function
      if (staffSessionToken) {
        const data = await callCancelAuditApi({
          operation: 'get_active_policy_numbers',
          params: {},
          sessionToken: staffSessionToken,
        });
        return new Set(data?.policyNumbers || []);
      }

      // Regular auth: direct Supabase query
      const { data, error } = await supabase
        .from('cancel_audit_records')
        .select('policy_number')
        .eq('agency_id', agencyId)
        .eq('is_active', true)
        .in('status', ['new', 'in_progress']);

      if (error) throw error;

      return new Set(data?.map(r => r.policy_number).filter(Boolean) || []);
    },
    enabled: !!agencyId,
    staleTime: 60000, // 1 minute - cancel audit data changes less frequently
  });
}
