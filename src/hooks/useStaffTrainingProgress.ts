import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface LessonProgress {
  lesson_id: string;
  completed: boolean;
  completed_at: string | null;
}

export function useStaffTrainingProgress() {
  return useQuery({
    queryKey: ['staff-training-progress'],
    queryFn: async () => {
      const sessionToken = localStorage.getItem('staff_session_token');
      
      if (!sessionToken) {
        throw new Error('No session token found');
      }

      const { data, error } = await supabase.functions.invoke('get_staff_training_progress', {
        body: { session_token: sessionToken }
      });

      if (error) throw error;
      if (!data) throw new Error('No data returned');

      return data as { progress: LessonProgress[] };
    },
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}
