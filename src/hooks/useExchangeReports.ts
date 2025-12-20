import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';

export interface ExchangeReport {
  id: string;
  post_id: string;
  reporter_user_id: string;
  reason: string;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  reporter: {
    full_name: string | null;
    email: string;
  };
  post: {
    id: string;
    content_text: string | null;
    file_name: string | null;
    content_type: string;
    user: {
      full_name: string | null;
      email: string;
    };
  };
}

export function useExchangeReports() {
  return useQuery({
    queryKey: ['exchange-reports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exchange_reports')
        .select(`
          *,
          reporter:profiles!reporter_user_id(full_name, email),
          post:exchange_posts!post_id(
            id,
            content_text,
            file_name,
            content_type,
            user:profiles!user_id(full_name, email)
          )
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as ExchangeReport[];
    },
  });
}

export function useResolveReport() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (reportId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('exchange_reports')
        .update({
          resolved_at: new Date().toISOString(),
          resolved_by: user.id,
        })
        .eq('id', reportId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exchange-reports'] });
      toast.success('Report resolved');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to resolve report');
    },
  });
}

export function useDeleteReportedPost() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ reportId, postId }: { reportId: string; postId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      // Delete the post
      const { error: deleteError } = await supabase
        .from('exchange_posts')
        .delete()
        .eq('id', postId);
      
      if (deleteError) throw deleteError;
      
      // Resolve the report
      const { error: resolveError } = await supabase
        .from('exchange_reports')
        .update({
          resolved_at: new Date().toISOString(),
          resolved_by: user.id,
        })
        .eq('id', reportId);
      
      if (resolveError) throw resolveError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exchange-reports'] });
      queryClient.invalidateQueries({ queryKey: ['exchange-feed'] });
      toast.success('Post deleted and report resolved');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete post');
    },
  });
}
