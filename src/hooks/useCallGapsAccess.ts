import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

/**
 * Hook to check if the given agency has access to the Call Gaps Analyzer.
 * Uses the SECURITY DEFINER `has_feature_access` RPC function which
 * bypasses RLS — safe for both JWT and anon callers.
 */
export function useCallGapsAccess(agencyId: string | null | undefined) {
  const { isAdmin } = useAuth();

  return useQuery({
    queryKey: ['call-gaps-access', agencyId],
    queryFn: async () => {
      // Admins always have access
      if (isAdmin) return { hasAccess: true };

      const { data, error } = await supabase.rpc('has_feature_access', {
        p_agency_id: agencyId!,
        p_feature_key: 'call_gaps',
      });

      if (error) {
        console.warn('Call gaps access check failed:', error);
        return { hasAccess: false };
      }

      return { hasAccess: data === true };
    },
    enabled: isAdmin || !!agencyId,
    staleTime: 60000,
    retry: false,
  });
}
