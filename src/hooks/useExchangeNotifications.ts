import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

interface ExchangeNotificationCounts {
  newPosts: number;
  newReplies: number;
  total: number;
}

export function useExchangeNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: counts, isLoading } = useQuery({
    queryKey: ['exchange-notifications', user?.id],
    queryFn: async (): Promise<ExchangeNotificationCounts> => {
      if (!user?.id) return { newPosts: 0, newReplies: 0, total: 0 };

      // Get user's last activity timestamps
      const { data: activity } = await supabase
        .from('exchange_user_activity')
        .select('last_feed_view, last_notifications_view')
        .eq('user_id', user.id)
        .maybeSingle();

      const lastFeedView = activity?.last_feed_view || '1970-01-01';
      const lastNotificationsView = activity?.last_notifications_view || '1970-01-01';

      // Count new posts since last feed view (exclude user's own posts)
      const { count: newPostsCount } = await supabase
        .from('exchange_posts')
        .select('*', { count: 'exact', head: true })
        .gt('created_at', lastFeedView)
        .neq('user_id', user.id);

      // Count new comments on user's posts since last notifications view
      const { data: userPostIds } = await supabase
        .from('exchange_posts')
        .select('id')
        .eq('user_id', user.id);

      let newRepliesCount = 0;
      if (userPostIds && userPostIds.length > 0) {
        const postIds = userPostIds.map(p => p.id);
        const { count } = await supabase
          .from('exchange_comments')
          .select('*', { count: 'exact', head: true })
          .in('post_id', postIds)
          .gt('created_at', lastNotificationsView)
          .neq('user_id', user.id); // Don't count user's own comments

        newRepliesCount = count || 0;
      }

      return {
        newPosts: newPostsCount || 0,
        newReplies: newRepliesCount,
        total: (newPostsCount || 0) + newRepliesCount,
      };
    },
    enabled: !!user?.id,
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 10000, // Consider data stale after 10 seconds
  });

  // Mark feed as viewed
  const markFeedViewed = useMutation({
    mutationFn: async () => {
      if (!user?.id) return;
      await supabase.rpc('upsert_exchange_activity', {
        p_user_id: user.id,
        p_update_feed: true,
        p_update_notifications: false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exchange-notifications'] });
    },
  });

  // Mark notifications as viewed
  const markNotificationsViewed = useMutation({
    mutationFn: async () => {
      if (!user?.id) return;
      await supabase.rpc('upsert_exchange_activity', {
        p_user_id: user.id,
        p_update_feed: false,
        p_update_notifications: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exchange-notifications'] });
    },
  });

  return {
    counts: counts || { newPosts: 0, newReplies: 0, total: 0 },
    isLoading,
    markFeedViewed: markFeedViewed.mutate,
    markNotificationsViewed: markNotificationsViewed.mutate,
  };
}
