import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

export interface ExchangeComment {
  id: string;
  post_id: string;
  user_id: string;
  parent_comment_id: string | null;
  content: string;
  created_at: string;
  user: {
    full_name: string | null;
    email: string;
  };
  replies?: ExchangeComment[];
}

export function usePostComments(postId: string) {
  return useQuery({
    queryKey: ['exchange-comments', postId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exchange_comments')
        .select(`
          *,
          user:profiles!user_id(full_name, email)
        `)
        .eq('post_id', postId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      
      // Organize into nested structure
      const comments = data as ExchangeComment[];
      const rootComments: ExchangeComment[] = [];
      const commentMap = new Map<string, ExchangeComment>();
      
      comments.forEach(comment => {
        comment.replies = [];
        commentMap.set(comment.id, comment);
      });
      
      comments.forEach(comment => {
        if (comment.parent_comment_id) {
          const parent = commentMap.get(comment.parent_comment_id);
          if (parent) {
            parent.replies!.push(comment);
          }
        } else {
          rootComments.push(comment);
        }
      });
      
      return rootComments;
    },
    enabled: !!postId,
  });
}

export function useCreateComment() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({ 
      postId, 
      content, 
      parentCommentId 
    }: { 
      postId: string; 
      content: string; 
      parentCommentId?: string;
    }) => {
      const { data, error } = await supabase
        .from('exchange_comments')
        .insert({
          post_id: postId,
          user_id: user!.id,
          content,
          parent_comment_id: parentCommentId || null,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['exchange-comments', variables.postId] });
      queryClient.invalidateQueries({ queryKey: ['exchange-feed'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to post comment');
    },
  });
}

export function useDeleteComment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ commentId, postId }: { commentId: string; postId: string }) => {
      const { error } = await supabase
        .from('exchange_comments')
        .delete()
        .eq('id', commentId);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['exchange-comments', variables.postId] });
      queryClient.invalidateQueries({ queryKey: ['exchange-feed'] });
      toast.success('Comment deleted');
    },
  });
}
