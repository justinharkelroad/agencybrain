import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

export function usePinPost() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({ postId, pin }: { postId: string; pin: boolean }) => {
      const { error } = await supabase
        .from('exchange_posts')
        .update({
          is_pinned: pin,
          pinned_at: pin ? new Date().toISOString() : null,
          pinned_by: pin ? user!.id : null,
        })
        .eq('id', postId);
      
      if (error) throw error;
    },
    onSuccess: (_, { pin }) => {
      queryClient.invalidateQueries({ queryKey: ['exchange-feed'] });
      toast.success(pin ? 'Post pinned to top' : 'Post unpinned');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update pin status');
    },
  });
}
