import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

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

// Helper to fetch training content directly from Supabase for admins
async function fetchAdminTrainingContent(agencyId: string) {
  // Fetch categories
  const { data: categories, error: catError } = await supabase
    .from('training_categories')
    .select('*')
    .eq('agency_id', agencyId)
    .eq('is_active', true)
    .order('sort_order');

  if (catError) throw catError;

  // Fetch modules
  const { data: modules, error: modError } = await supabase
    .from('training_modules')
    .select('*')
    .eq('agency_id', agencyId)
    .eq('is_active', true)
    .order('sort_order');

  if (modError) throw modError;

  // Fetch lessons
  const { data: lessons, error: lessonError } = await supabase
    .from('training_lessons')
    .select('*')
    .eq('agency_id', agencyId)
    .eq('is_active', true)
    .order('sort_order');

  if (lessonError) throw lessonError;

  // Get lesson IDs for attachments/quizzes
  const lessonIds = (lessons || []).map(l => l.id);

  // Fetch attachments
  const { data: attachments } = await supabase
    .from('training_attachments')
    .select('*')
    .in('lesson_id', lessonIds.length > 0 ? lessonIds : ['no-lessons']);

  // Fetch quizzes
  const { data: quizzes } = await supabase
    .from('training_quizzes')
    .select('*')
    .in('lesson_id', lessonIds.length > 0 ? lessonIds : ['no-lessons']);

  const quizIds = (quizzes || []).map(q => q.id);

  // Fetch quiz questions
  const { data: quizQuestions } = await supabase
    .from('training_quiz_questions')
    .select('*')
    .in('quiz_id', quizIds.length > 0 ? quizIds : ['no-quizzes'])
    .order('sort_order');

  const questionIds = (quizQuestions || []).map(q => q.id);

  // Fetch quiz options
  const { data: quizOptions } = await supabase
    .from('training_quiz_options')
    .select('*')
    .in('question_id', questionIds.length > 0 ? questionIds : ['no-questions'])
    .order('sort_order');

  // Transform to nested structure
  const categoriesWithModules: TrainingCategory[] = (categories || []).map((cat: any) => ({
    ...cat,
    modules: (modules || [])
      .filter((mod: any) => mod.category_id === cat.id)
      .map((mod: any) => ({
        ...mod,
        title: mod.name,
        lessons: (lessons || [])
          .filter((lesson: any) => lesson.module_id === mod.id)
          .map((lesson: any) => ({
            ...lesson,
            title: lesson.name,
            content: lesson.content_html,
            thumbnail_url: lesson.thumbnail_url || null
          }))
          .sort((a: any, b: any) => a.sort_order - b.sort_order)
      }))
      .sort((a: any, b: any) => a.sort_order - b.sort_order)
  })).sort((a: any, b: any) => a.sort_order - b.sort_order);

  // Group attachments by lesson_id
  const attachmentsByLesson: Record<string, TrainingAttachment[]> = {};
  (attachments || []).forEach((att: any) => {
    if (att.lesson_id) {
      if (!attachmentsByLesson[att.lesson_id]) {
        attachmentsByLesson[att.lesson_id] = [];
      }
      attachmentsByLesson[att.lesson_id].push(att);
    }
  });

  // Group quizzes with questions and options
  const quizzesByLesson: Record<string, TrainingQuiz[]> = {};
  (quizzes || []).forEach((quiz: any) => {
    if (quiz.lesson_id) {
      const quizQuestionsWithOptions = (quizQuestions || [])
        .filter((q: any) => q.quiz_id === quiz.id)
        .map((q: any) => ({
          ...q,
          options: (quizOptions || [])
            .filter((opt: any) => opt.question_id === q.id)
            .sort((a: any, b: any) => a.sort_order - b.sort_order)
        }))
        .sort((a: any, b: any) => a.sort_order - b.sort_order);

      const fullQuiz = { ...quiz, questions: quizQuestionsWithOptions };

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
    no_assignments: false,
    isAdmin: true
  };
}

export function useStaffTrainingContent(agencyId: string | undefined) {
  const { user: supabaseUser } = useAuth();

  return useQuery({
    queryKey: ['staff-training-content', agencyId, !!supabaseUser],
    queryFn: async () => {
      if (!agencyId) {
        throw new Error('Agency ID is required');
      }

      // ADMIN PATH: If logged in via Supabase Auth, fetch directly
      if (supabaseUser) {
        console.log('Admin detected, fetching training content directly from Supabase');
        return fetchAdminTrainingContent(agencyId);
      }

      // STAFF PATH: Use edge function with session token
      const sessionToken = localStorage.getItem('staff_session_token');
      
      if (!sessionToken) {
        throw new Error('No session token found');
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
