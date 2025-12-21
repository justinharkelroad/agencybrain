import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

export interface ExchangeConversation {
  id: string;
  participant_one: string;
  participant_two: string;
  last_message_at: string;
  other_user: {
    id: string;
    full_name: string | null;
    email: string;
    agency?: { name: string } | null;
  };
  last_message?: {
    content: string | null;
    sender_id: string;
    created_at: string;
  };
  unread_count: number;
}

export interface ExchangeMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  file_path: string | null;
  file_name: string | null;
  read_at: string | null;
  created_at: string;
  sender: {
    full_name: string | null;
    email: string;
  };
}

export function useConversations() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['exchange-conversations'],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('exchange_conversations')
        .select('*')
        .or(`participant_one.eq.${user.id},participant_two.eq.${user.id}`)
        .order('last_message_at', { ascending: false });
      
      if (error) throw error;
      if (!data || data.length === 0) return [];
      
      // Get all user IDs we need to fetch
      const userIds = new Set<string>();
      data.forEach(conv => {
        userIds.add(conv.participant_one);
        userIds.add(conv.participant_two);
      });
      
      // Fetch profiles using SECURITY DEFINER function to bypass RLS
      const { data: profiles } = await supabase.rpc('get_conversation_participants', {
        participant_ids: Array.from(userIds),
      });
      
      const profileMap = new Map(profiles?.map((p: { id: string; full_name: string | null; email: string; agency_name: string | null }) => [
        p.id, 
        { 
          id: p.id, 
          full_name: p.full_name, 
          email: p.email, 
          agency: p.agency_name ? { name: p.agency_name } : null 
        }
      ]) || []);
      
      // Build conversations with details
      const conversationsWithMessages = await Promise.all(
        data.map(async (conv) => {
          const otherUserId = conv.participant_one === user.id 
            ? conv.participant_two 
            : conv.participant_one;
          const otherUserProfile = profileMap.get(otherUserId) as { 
            id: string; 
            full_name: string | null; 
            email: string; 
            agency: { name: string } | null 
          } | undefined;
          
          // Get last message
          const { data: lastMsg } = await supabase
            .from('exchange_messages')
            .select('content, sender_id, created_at')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          // Get unread count
          const { count } = await supabase
            .from('exchange_messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .neq('sender_id', user.id)
            .is('read_at', null);
          
          return {
            ...conv,
            other_user: {
              id: otherUserId,
              full_name: otherUserProfile?.full_name || null,
              email: otherUserProfile?.email || '',
              agency: otherUserProfile?.agency || null,
            },
            last_message: lastMsg || undefined,
            unread_count: count || 0,
          };
        })
      );
      
      return conversationsWithMessages as ExchangeConversation[];
    },
    enabled: !!user,
  });
}

export function useConversationMessages(conversationId: string | null) {
  return useQuery({
    queryKey: ['exchange-messages', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      
      const { data, error } = await supabase
        .from('exchange_messages')
        .select(`
          *,
          sender:profiles!sender_id(full_name, email)
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data as ExchangeMessage[];
    },
    enabled: !!conversationId,
  });
}

export function useStartConversation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (otherUserId: string) => {
      if (!user) throw new Error('Not authenticated');
      
      // Ensure consistent ordering
      const [p1, p2] = [user.id, otherUserId].sort();
      
      // Check if conversation exists
      const { data: existing } = await supabase
        .from('exchange_conversations')
        .select('id')
        .eq('participant_one', p1)
        .eq('participant_two', p2)
        .maybeSingle();
      
      if (existing) return existing;
      
      // Create new conversation
      const { data, error } = await supabase
        .from('exchange_conversations')
        .insert({
          participant_one: p1,
          participant_two: p2,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exchange-conversations'] });
    },
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({ 
      conversationId, 
      content, 
      filePath, 
      fileName 
    }: { 
      conversationId: string; 
      content?: string; 
      filePath?: string;
      fileName?: string;
    }) => {
      if (!user) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('exchange_messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          content,
          file_path: filePath,
          file_name: fileName,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Update conversation last_message_at
      await supabase
        .from('exchange_conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversationId);
      
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['exchange-messages', variables.conversationId] });
      queryClient.invalidateQueries({ queryKey: ['exchange-conversations'] });
    },
  });
}

export function useMarkMessagesRead() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (conversationId: string) => {
      if (!user) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('exchange_messages')
        .update({ read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .neq('sender_id', user.id)
        .is('read_at', null);
      
      if (error) throw error;
    },
    onSuccess: (_, conversationId) => {
      queryClient.invalidateQueries({ queryKey: ['exchange-messages', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['exchange-conversations'] });
    },
  });
}

export function useTotalUnreadCount() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['exchange-unread-count'],
    queryFn: async () => {
      if (!user) return 0;
      
      // Get all conversations for the user
      const { data: conversations } = await supabase
        .from('exchange_conversations')
        .select('id')
        .or(`participant_one.eq.${user.id},participant_two.eq.${user.id}`);
      
      if (!conversations || conversations.length === 0) return 0;
      
      const conversationIds = conversations.map(c => c.id);
      
      // Count unread messages
      const { count } = await supabase
        .from('exchange_messages')
        .select('*', { count: 'exact', head: true })
        .in('conversation_id', conversationIds)
        .neq('sender_id', user.id)
        .is('read_at', null);
      
      return count || 0;
    },
    enabled: !!user,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}
