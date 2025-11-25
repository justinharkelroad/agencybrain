import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { TrainingLesson, TrainingLessonInsert, TrainingLessonUpdate } from '@/types/training';
import { toast } from 'sonner';

export function useTrainingLessons(categoryId?: string) {
  const queryClient = useQueryClient();

  // Fetch lessons for a category
  const { data: lessons, isLoading, error } = useQuery({
    queryKey: ['training-lessons', categoryId],
    queryFn: async () => {
      if (!categoryId) return [];
      
      const { data, error } = await supabase
        .from('training_lessons')
        .select('*')
        .eq('category_id', categoryId)
        .order('display_order', { ascending: true });

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
