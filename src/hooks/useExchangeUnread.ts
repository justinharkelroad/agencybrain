import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/auth';

export function useUnreadPostCount() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['exchange-unread-posts'],
    queryFn: async () => {
      // Get user's latest view time
      const { data: lastView } = await supabase
        .from('exchange_post_views')
        .select('viewed_at')
        .eq('user_id', user!.id)
        .order('viewed_at', { ascending: false })
        .limit(1)
        .single();
      
      // Count posts created after last view
      let query = supabase
        .from('exchange_posts')
        .select('id', { count: 'exact', head: true });
      
      if (lastView?.viewed_at) {
        query = query.gt('created_at', lastView.viewed_at);
      }
      
      const { count, error } = await query;
      if (error) throw error;
      
      return count || 0;
    },
    enabled: !!user,
    refetchInterval: 60000, // Refresh every minute
  });
}

export function useMarkPostsViewed() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (postIds: string[]) => {
      if (!postIds.length) return;
      
      // Upsert view records for all posts
      const { error } = await supabase
        .from('exchange_post_views')
        .upsert(
          postIds.map(postId => ({
            user_id: user!.id,
            post_id: postId,
            viewed_at: new Date().toISOString(),
          })),
          { onConflict: 'user_id,post_id' }
        );
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exchange-unread-posts'] });
    },
  });
}

export function useUnreadMessageCount() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['exchange-unread-messages'],
    queryFn: async () => {
      // Get conversations where user is participant
      const { data: conversations } = await supabase
        .from('exchange_conversations')
        .select('id')
        .or(`participant_one.eq.${user!.id},participant_two.eq.${user!.id}`);
      
      if (!conversations?.length) return 0;
      
      const conversationIds = conversations.map(c => c.id);
      
      // Count unread messages
      const { count, error } = await supabase
        .from('exchange_messages')
        .select('id', { count: 'exact', head: true })
        .in('conversation_id', conversationIds)
        .neq('sender_id', user!.id)
        .is('read_at', null);
      
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}
