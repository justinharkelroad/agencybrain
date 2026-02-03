import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/auth';
import { useSalesExperienceAccess } from './useSalesExperienceAccess';

/**
 * Hook to get unread sales experience message count for agency owners.
 * Returns count of coach messages that haven't been read yet.
 */
export function useSalesExperienceUnreadMessages() {
  const { user, isAdmin } = useAuth();
  const { hasAccess, assignment } = useSalesExperienceAccess();

  return useQuery({
    queryKey: ['sales-experience-unread-messages', assignment?.id, user?.id],
    queryFn: async () => {
      if (!assignment?.id || !user?.id) return 0;

      // Count unread messages from coach (sender_type = 'coach' and read_at is null)
      // that are targeted to this user (or broadcast to all)
      const { count, error } = await supabase
        .from('sales_experience_messages')
        .select('id', { count: 'exact', head: true })
        .eq('assignment_id', assignment.id)
        .eq('sender_type', 'coach')
        .is('read_at', null)
        .or(`recipient_user_id.is.null,recipient_user_id.eq.${user.id}`);

      if (error) {
        console.error('Error fetching unread messages:', error);
        return 0;
      }

      return count || 0;
    },
    enabled: !!user && !isAdmin && hasAccess && !!assignment?.id,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

/**
 * Hook for admins to get unread sales experience message count.
 * Returns count of owner messages that haven't been read yet.
 */
export function useSalesExperienceAdminUnreadMessages() {
  const { user, isAdmin } = useAuth();

  return useQuery({
    queryKey: ['sales-experience-admin-unread-messages'],
    queryFn: async () => {
      // Count unread messages from owners (sender_type = 'owner' and is_read = false)
      const { count, error } = await supabase
        .from('sales_experience_messages')
        .select('id', { count: 'exact', head: true })
        .eq('sender_type', 'owner')
        .eq('is_read', false);

      if (error) {
        console.error('Error fetching admin unread messages:', error);
        return 0;
      }

      return count || 0;
    },
    enabled: !!user && isAdmin,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}
