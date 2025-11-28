import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export function useUpdateTrainingProgress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ lessonId, completed }: { lessonId: string; completed: boolean }) => {
      const sessionToken = localStorage.getItem('staff_session_token');
      
      if (!sessionToken) {
        throw new Error('No session token found');
      }

      const { data, error } = await supabase.functions.invoke('update_staff_training_progress', {
        body: {
          session_token: sessionToken,
          lesson_id: lessonId,
          status: completed ? 'completed' : 'not_started',
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-training-progress'] });
      toast({
        title: 'Progress updated',
        description: 'Your training progress has been saved.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update progress',
        variant: 'destructive',
      });
    },
  });
}
