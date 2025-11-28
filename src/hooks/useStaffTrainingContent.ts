import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface TrainingLesson {
  id: string;
  title: string;
  content: string | null;
  order_index: number;
  video_url: string | null;
  module_id: string;
  created_at: string;
}

interface TrainingModule {
  id: string;
  title: string;
  description: string | null;
  order_index: number;
  category_id: string;
  lessons: TrainingLesson[];
}

interface TrainingCategory {
  id: string;
  name: string;
  description: string | null;
  order_index: number;
  modules: TrainingModule[];
}

export function useStaffTrainingContent(agencyId: string | undefined) {
  return useQuery({
    queryKey: ['staff-training-content', agencyId],
    queryFn: async () => {
      const sessionToken = localStorage.getItem('staff_session_token');
      
      if (!sessionToken) {
        throw new Error('No session token found');
      }

      if (!agencyId) {
        throw new Error('Agency ID is required');
      }

      const { data, error } = await supabase.functions.invoke('get_staff_training_content', {
        body: { 
          session_token: sessionToken,
          agency_id: agencyId
        }
      });

      if (error) throw error;
      if (!data) throw new Error('No data returned');

      // Transform flat arrays into nested structure
      const categoriesWithModules: TrainingCategory[] = (data.categories || []).map((cat: any) => ({
        ...cat,
        modules: (data.modules || [])
          .filter((mod: any) => mod.category_id === cat.id)
          .map((mod: any) => ({
            ...mod,
            lessons: (data.lessons || [])
              .filter((lesson: any) => lesson.module_id === mod.id)
              .sort((a: any, b: any) => a.order_index - b.order_index)
          }))
          .sort((a: any, b: any) => a.order_index - b.order_index)
      })).sort((a: any, b: any) => a.order_index - b.order_index);

      return { categories: categoriesWithModules };
    },
    enabled: !!agencyId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
