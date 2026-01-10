import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as trainingApi from '@/lib/trainingAdminApi';
import type { TrainingQuiz, QuizWithQuestionsInsert } from '@/lib/trainingAdminApi';

export type { TrainingQuiz, QuizWithQuestionsInsert };

export interface TrainingQuizQuestion {
  id: string;
  quiz_id: string;
  question_text: string;
  question_type: 'multiple_choice' | 'true_false' | 'text_response';
  sort_order: number | null;
  options?: TrainingQuizOption[];
}

export interface TrainingQuizOption {
  id: string;
  question_id: string;
  option_text: string;
  is_correct: boolean | null;
  sort_order: number | null;
}

export function useTrainingQuizzes(lessonId?: string, agencyId?: string) {
  const queryClient = useQueryClient();

  const { data: quizzes = [], isLoading, error } = useQuery({
    queryKey: ['training-quizzes', lessonId],
    queryFn: async () => {
      if (!lessonId) return [];
      return trainingApi.listQuizzes(lessonId);
    },
    enabled: !!lessonId,
  });

  const createQuizWithQuestions = useMutation({
    mutationFn: async (data: QuizWithQuestionsInsert) => {
      return trainingApi.createQuizWithQuestions(data);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['training-quizzes', data.lesson_id] });
      toast.success('Quiz created successfully');
    },
    onError: (error: Error) => {
      console.error('Create quiz error:', error);
      toast.error(error.message || 'Failed to create quiz');
    },
  });

  const deleteQuiz = useMutation({
    mutationFn: async (quizId: string) => {
      return trainingApi.deleteQuiz(quizId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-quizzes'] });
      toast.success('Quiz deleted');
    },
    onError: (error: Error) => {
      console.error('Delete quiz error:', error);
      toast.error(error.message || 'Failed to delete quiz');
    },
  });

  return {
    quizzes,
    isLoading,
    error,
    createQuizWithQuestions: createQuizWithQuestions.mutate,
    deleteQuiz: deleteQuiz.mutate,
    isCreating: createQuizWithQuestions.isPending,
    isDeleting: deleteQuiz.isPending,
  };
}
