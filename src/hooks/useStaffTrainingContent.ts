import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface TrainingLesson {
  id: string;
  title: string;
  content: string | null;
  thumbnail_url: string | null;
  sort_order: number;
  video_url: string | null;
  module_id: string;
  created_at: string;
}

interface TrainingModule {
  id: string;
  title: string;
  description: string | null;
  sort_order: number;
  category_id: string;
  due_date?: string | null;
  lessons: TrainingLesson[];
}

interface TrainingCategory {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  modules: TrainingModule[];
}

interface TrainingAttachment {
  id: string;
  name: string;
  file_url: string;
  is_external_link: boolean;
  lesson_id: string | null;
}

interface TrainingQuizOption {
  id: string;
  question_id: string;
  option_text: string;
  is_correct: boolean;
  sort_order: number;
}

interface TrainingQuizQuestion {
  id: string;
  quiz_id: string;
  question_text: string;
  question_type: string;
  sort_order: number;
  options: TrainingQuizOption[];
}

interface TrainingQuiz {
  id: string;
  name: string;
  description: string | null;
  lesson_id: string | null;
  passing_score: number;
  questions: TrainingQuizQuestion[];
}

export type { TrainingQuiz, TrainingAttachment };

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

      // Check if no assignments
      if (data.no_assignments) {
        return {
          categories: [],
          attachmentsByLesson: {},
          quizzesByLesson: {},
          no_assignments: true
        };
      }

      // Transform flat arrays into nested structure with aliases for UI compatibility
      const categoriesWithModules: TrainingCategory[] = (data.categories || []).map((cat: any) => ({
        ...cat,
        modules: (data.modules || [])
          .filter((mod: any) => mod.category_id === cat.id)
          .map((mod: any) => ({
            ...mod,
            title: mod.name, // Add title alias for UI
            lessons: (data.lessons || [])
              .filter((lesson: any) => lesson.module_id === mod.id)
              .map((lesson: any) => ({
                ...lesson,
                title: lesson.name, // Add title alias for UI
                content: lesson.content_html, // Add content alias for UI
                thumbnail_url: lesson.thumbnail_url || null // Include thumbnail
              }))
              .sort((a: any, b: any) => a.sort_order - b.sort_order)
          }))
          .sort((a: any, b: any) => a.sort_order - b.sort_order)
      })).sort((a: any, b: any) => a.sort_order - b.sort_order);

      // Group attachments by lesson_id
      const attachmentsByLesson: Record<string, TrainingAttachment[]> = {};
      (data.attachments || []).forEach((att: any) => {
        if (att.lesson_id) {
          if (!attachmentsByLesson[att.lesson_id]) {
            attachmentsByLesson[att.lesson_id] = [];
          }
          attachmentsByLesson[att.lesson_id].push(att);
        }
      });

      // Group quizzes with their questions and options
      const quizzesByLesson: Record<string, TrainingQuiz[]> = {};
      (data.quizzes || []).forEach((quiz: any) => {
        if (quiz.lesson_id) {
          const quizQuestions = (data.quiz_questions || [])
            .filter((q: any) => q.quiz_id === quiz.id)
            .map((q: any) => ({
              ...q,
              options: (data.quiz_options || [])
                .filter((opt: any) => opt.question_id === q.id)
                .sort((a: any, b: any) => a.sort_order - b.sort_order)
            }))
            .sort((a: any, b: any) => a.sort_order - b.sort_order);

          const fullQuiz = { ...quiz, questions: quizQuestions };
          
          if (!quizzesByLesson[quiz.lesson_id]) {
            quizzesByLesson[quiz.lesson_id] = [];
          }
          quizzesByLesson[quiz.lesson_id].push(fullQuiz);
        }
      });

      return { 
        categories: categoriesWithModules,
        attachmentsByLesson,
        quizzesByLesson,
        no_assignments: false
      };
    },
    enabled: !!agencyId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
