import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/auth';

export function useExchangeRealtime() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  useEffect(() => {
    if (!user) return;
    
    const channel = supabase
      .channel('exchange-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'exchange_posts' },
        (payload) => {
          console.log('Exchange post change:', payload.eventType);
          queryClient.invalidateQueries({ queryKey: ['exchange-feed'] });
          queryClient.invalidateQueries({ queryKey: ['exchange-notifications'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'exchange_comments' },
        (payload) => {
          console.log('Exchange comment change:', payload.eventType);
          const postId = (payload.new as any)?.post_id || (payload.old as any)?.post_id;
          if (postId) {
            queryClient.invalidateQueries({ queryKey: ['exchange-comments', postId] });
          }
          queryClient.invalidateQueries({ queryKey: ['exchange-feed'] });
          queryClient.invalidateQueries({ queryKey: ['exchange-notifications'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'exchange_likes' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['exchange-feed'] });
        }
      )
      // Add message realtime subscriptions
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'exchange_messages' },
        (payload) => {
          console.log('New exchange message:', payload);
          const msgConversationId = (payload.new as any)?.conversation_id;
          if (msgConversationId) {
            queryClient.invalidateQueries({ queryKey: ['exchange-messages', msgConversationId] });
          }
          queryClient.invalidateQueries({ queryKey: ['exchange-conversations'] });
          queryClient.invalidateQueries({ queryKey: ['exchange-unread-count'] });
          queryClient.invalidateQueries({ queryKey: ['exchange-unread-messages'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'exchange_conversations' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['exchange-conversations'] });
        }
      )
      .subscribe((status) => {
        console.log('Exchange realtime subscription status:', status);
      });
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, user]);
}

export function useMessagesRealtime(conversationId?: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  useEffect(() => {
    if (!user) return;
    
    const channel = supabase
      .channel('exchange-messages-realtime')
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'exchange_messages',
        },
        (payload) => {
          console.log('New message:', payload);
          const msgConversationId = (payload.new as any)?.conversation_id;
          if (msgConversationId) {
            queryClient.invalidateQueries({ queryKey: ['exchange-messages', msgConversationId] });
          }
          queryClient.invalidateQueries({ queryKey: ['exchange-conversations'] });
          queryClient.invalidateQueries({ queryKey: ['exchange-unread-count'] });
        }
      )
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'exchange_conversations'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['exchange-conversations'] });
        }
      )
      .subscribe((status) => {
        console.log('Messages realtime subscription status:', status);
      });
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient, user]);
}
