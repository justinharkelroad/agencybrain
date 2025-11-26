import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface TrainingLesson {
  id: string;
  agency_id: string;
  module_id: string;
  name: string;
  description: string | null;
  video_url: string | null;
  video_platform: string | null;
  content_html: string | null;
  sort_order: number | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface TrainingLessonInsert {
  agency_id: string;
  module_id: string;
  name: string;
  description?: string | null;
  video_url?: string | null;
  video_platform?: string | null;
  content_html?: string | null;
  sort_order?: number | null;
  is_active?: boolean | null;
}

export interface TrainingLessonUpdate {
  name?: string;
  description?: string | null;
  video_url?: string | null;
  video_platform?: string | null;
  content_html?: string | null;
  sort_order?: number | null;
  is_active?: boolean | null;
}

export function useTrainingLessons(categoryId?: string) {
  const queryClient = useQueryClient();

  // Fetch all lessons for a module (category)
  const { data: lessons, isLoading, error } = useQuery({
    queryKey: ['training-lessons', categoryId],
    queryFn: async () => {
      if (!categoryId) return [];
      
      const { data, error } = await supabase
        .from('training_lessons')
        .select('*')
        .eq('module_id', categoryId)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data as TrainingLesson[];
    },
    enabled: !!categoryId,
  });

  // Create lesson mutation
  const createLesson = useMutation({
    mutationFn: async (lesson: TrainingLessonInsert) => {
      const { data, error } = await supabase
        .from('training_lessons')
        .insert(lesson)
        .select()
        .single();

      if (error) throw error;
      return data as TrainingLesson;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-lessons'] });
      toast.success('Lesson created successfully');
    },
    onError: (error: Error) => {
      console.error('Error creating lesson:', error);
      toast.error('Failed to create lesson');
    },
  });

  // Update lesson mutation
  const updateLesson = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: TrainingLessonUpdate }) => {
      const { data, error } = await supabase
        .from('training_lessons')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as TrainingLesson;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-lessons'] });
      toast.success('Lesson updated successfully');
    },
    onError: (error: Error) => {
      console.error('Error updating lesson:', error);
      toast.error('Failed to update lesson');
    },
  });

  // Delete lesson mutation
  const deleteLesson = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('training_lessons')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-lessons'] });
      toast.success('Lesson deleted successfully');
    },
    onError: (error: Error) => {
      console.error('Error deleting lesson:', error);
      toast.error('Failed to delete lesson');
    },
  });

  return {
    lessons,
    isLoading,
    error,
    createLesson: createLesson.mutate,
    updateLesson: updateLesson.mutate,
    deleteLesson: deleteLesson.mutate,
    isCreating: createLesson.isPending,
    isUpdating: updateLesson.isPending,
    isDeleting: deleteLesson.isPending,
  };
}
