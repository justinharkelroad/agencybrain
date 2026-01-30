import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useStaffAuth } from '@/hooks/useStaffAuth';

/**
 * Hook to get the count of overdue onboarding tasks for staff users (Staff portal).
 * Uses the edge function since staff users don't have auth.uid for RLS.
 */
export function useStaffOverdueTaskCount() {
  const { user, sessionToken } = useStaffAuth();

  return useQuery({
    queryKey: ['staff-overdue-task-count', user?.id],
    queryFn: async () => {
      if (!user?.id || !sessionToken) return 0;

      // Call the edge function to get tasks
      const { data, error } = await supabase.functions.invoke('get_staff_onboarding_tasks', {
        headers: {
          'X-Staff-Session': sessionToken,
        },
        body: {
          include_completed_today: false, // We only need counts
        },
      });

      if (error) {
        console.error('[useStaffOverdueTaskCount] Error:', error);
        return 0;
      }

      // The edge function returns stats.overdue
      return data?.stats?.overdue || 0;
    },
    enabled: !!user?.id && !!sessionToken,
    staleTime: 60 * 1000, // Cache for 1 minute
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });
}
