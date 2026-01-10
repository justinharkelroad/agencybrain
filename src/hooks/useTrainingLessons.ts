import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as trainingApi from '@/lib/trainingAdminApi';
import type { TrainingLesson, TrainingLessonInsert } from '@/lib/trainingAdminApi';

export type { TrainingLesson, TrainingLessonInsert };

export interface TrainingLessonUpdate {
  name?: string;
  description?: string | null;
  video_url?: string | null;
  video_platform?: string | null;
  content_html?: string | null;
  thumbnail_url?: string | null;
  sort_order?: number | null;
  is_active?: boolean | null;
}

export function useTrainingLessons(moduleId?: string) {
  const queryClient = useQueryClient();

  const { data: lessons = [], isLoading, error } = useQuery({
    queryKey: ['training-lessons', moduleId],
    queryFn: async () => {
      if (!moduleId) return [];
      return trainingApi.listLessons(moduleId);
    },
    enabled: !!moduleId,
  });

  const createLesson = useMutation({
    mutationFn: async (lesson: TrainingLessonInsert) => {
      return trainingApi.createLesson(lesson);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-lessons'] });
      toast.success('Lesson created successfully');
    },
    onError: (error: Error) => {
      console.error('Error creating lesson:', error);
      toast.error(error.message || 'Failed to create lesson');
    },
  });

  const updateLesson = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: TrainingLessonUpdate }) => {
      return trainingApi.updateLesson(id, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-lessons'] });
      toast.success('Lesson updated successfully');
    },
    onError: (error: Error) => {
      console.error('Error updating lesson:', error);
      toast.error(error.message || 'Failed to update lesson');
    },
  });

  const deleteLesson = useMutation({
    mutationFn: async (id: string) => {
      return trainingApi.deleteLesson(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-lessons'] });
      toast.success('Lesson deleted successfully');
    },
    onError: (error: Error) => {
      console.error('Error deleting lesson:', error);
      toast.error(error.message || 'Failed to delete lesson');
    },
  });

  return {
    lessons,
    isLoading,
    error,
    createLesson: createLesson.mutate,
    createLessonAsync: createLesson.mutateAsync,
    updateLesson: updateLesson.mutate,
    deleteLesson: deleteLesson.mutate,
    isCreating: createLesson.isPending,
    isUpdating: updateLesson.isPending,
    isDeleting: deleteLesson.isPending,
  };
}
