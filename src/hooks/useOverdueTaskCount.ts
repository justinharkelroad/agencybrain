import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

/**
 * Hook to get the count of overdue onboarding tasks for the current user (Brain portal).
 * Used for the sidebar badge notification.
 */
export function useOverdueTaskCount() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['overdue-task-count', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;

      // Get user's profile to find their agency and linked staff user
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('agency_id')
        .eq('id', user.id)
        .single();

      if (profileError || !profile?.agency_id) {
        return 0;
      }

      // Find the user's linked staff user
      const { data: staffUser, error: staffError } = await supabase
        .from('staff_users')
        .select('id')
        .eq('agency_id', profile.agency_id)
        .eq('linked_profile_id', user.id)
        .maybeSingle();

      if (staffError || !staffUser?.id) {
        return 0;
      }

      // Count overdue tasks assigned to this staff user
      const { count, error: countError } = await supabase
        .from('onboarding_tasks')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_to_staff_user_id', staffUser.id)
        .eq('status', 'overdue');

      if (countError) {
        console.error('[useOverdueTaskCount] Error counting tasks:', countError);
        return 0;
      }

      return count || 0;
    },
    enabled: !!user?.id,
    staleTime: 60 * 1000, // Cache for 1 minute
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });
}
