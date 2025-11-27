import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface TrainingLesson {
  id: string;
  title: string;
  content: string | null;
  order_index: number;
  video_url: string | null;
  created_at: string;
}

interface TrainingModule {
  id: string;
  title: string;
  description: string | null;
  order_index: number;
  lessons: TrainingLesson[];
}

interface TrainingCategory {
  id: string;
  name: string;
  description: string | null;
  order_index: number;
  modules: TrainingModule[];
}

export function useStaffTrainingContent() {
  return useQuery({
    queryKey: ['staff-training-content'],
    queryFn: async () => {
      const sessionToken = localStorage.getItem('staff_session_token');
      
      if (!sessionToken) {
        throw new Error('No session token found');
      }

      const { data, error } = await supabase.functions.invoke('get_staff_training_content', {
        body: { session_token: sessionToken }
      });

      if (error) throw error;
      if (!data) throw new Error('No data returned');

      return data as { categories: TrainingCategory[] };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
