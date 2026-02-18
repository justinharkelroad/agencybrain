import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// --- Types ---

interface GenerateLessonParams {
  topic: string;
  lesson_name?: string;
  agency_id: string | null;
}

interface GenerateQuizParams {
  lesson_id: string;
  lesson_content: string;
  lesson_name?: string;
  agency_id: string | null;
  question_count?: number;
}

interface RewriteContentParams {
  existing_content: string;
  rewrite_mode: 'clearer' | 'concise' | 'actionable' | 'beginner_friendly';
  agency_id: string | null;
}

interface AIQuestion {
  question_text: string;
  options: { option_text: string; is_correct: boolean }[];
}

// --- Mutations ---

export function useGenerateLessonContent() {
  return useMutation({
    mutationFn: async ({ topic, lesson_name, agency_id }: GenerateLessonParams) => {
      const { data, error } = await supabase.functions.invoke('generate-training-content', {
        body: { mode: 'generate_lesson', topic, lesson_name, agency_id },
      });

      if (error) {
        console.error('Edge function error:', error);
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      return data.content_html as string;
    },
    onSuccess: () => {
      toast.success('Lesson content generated');
    },
    onError: (error) => {
      console.error('Generate lesson error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate lesson content');
    },
  });
}

export function useGenerateQuizFromLesson() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ lesson_id, lesson_content, lesson_name, agency_id, question_count }: GenerateQuizParams) => {
      // Check if a quiz already exists for this lesson (UNIQUE constraint on lesson_id)
      const { data: existingQuiz } = await supabase
        .from('training_quizzes')
        .select('id')
        .eq('lesson_id', lesson_id)
        .maybeSingle();

      if (existingQuiz) {
        throw new Error('A quiz already exists for this lesson. Delete the existing quiz first.');
      }

      // Call edge function to generate questions
      const { data, error } = await supabase.functions.invoke('generate-training-content', {
        body: { mode: 'generate_quiz', lesson_content, lesson_name, agency_id, question_count },
      });

      if (error) {
        console.error('Edge function error:', error);
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      const questions: AIQuestion[] = data.questions;
      if (!questions || questions.length === 0) {
        throw new Error('No questions were generated');
      }

      // Get agency_id from lesson if not provided (for admin/Standard Playbook)
      let quizAgencyId = agency_id;
      if (!quizAgencyId) {
        const { data: lesson } = await supabase
          .from('training_lessons')
          .select('agency_id')
          .eq('id', lesson_id)
          .single();
        quizAgencyId = lesson?.agency_id;
      }

      if (!quizAgencyId) {
        throw new Error('Could not determine agency_id for quiz');
      }

      // Step 1: Insert quiz
      const { data: quiz, error: quizError } = await supabase
        .from('training_quizzes')
        .insert({
          lesson_id,
          agency_id: quizAgencyId,
          name: 'AI Generated Quiz',
          is_active: true,
        })
        .select('id')
        .single();

      if (quizError) {
        throw new Error(`Failed to create quiz: ${quizError.message}`);
      }

      // Step 2 & 3: Insert questions sequentially, then their options
      for (let qi = 0; qi < questions.length; qi++) {
        const q = questions[qi];

        const { data: insertedQuestion, error: questionError } = await supabase
          .from('training_quiz_questions')
          .insert({
            quiz_id: quiz.id,
            question_text: q.question_text,
            question_type: 'multiple_choice',
            sort_order: qi,
          })
          .select('id')
          .single();

        if (questionError) {
          throw new Error(`Failed to create question ${qi + 1}: ${questionError.message}`);
        }

        // Insert options for this question
        const optionRows = q.options.map((opt, oi) => ({
          question_id: insertedQuestion.id,
          option_text: opt.option_text,
          is_correct: opt.is_correct,
          sort_order: oi,
        }));

        const { error: optionsError } = await supabase
          .from('training_quiz_options')
          .insert(optionRows);

        if (optionsError) {
          throw new Error(`Failed to create options for question ${qi + 1}: ${optionsError.message}`);
        }
      }

      // Invalidate quiz cache
      queryClient.invalidateQueries({ queryKey: ['training-quizzes', lesson_id] });

      return { quizId: quiz.id, questionCount: questions.length };
    },
    onSuccess: (result) => {
      toast.success(`Quiz generated with ${result.questionCount} questions`);
    },
    onError: (error) => {
      console.error('Generate quiz error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate quiz');
    },
  });
}

// SP-specific: calls edge function only, returns questions in sp_quizzes JSON format (no DB writes)
export interface SPQuizQuestion {
  id: string;
  question: string;
  options: string[];
  correct_index: number;
}

interface GenerateSPQuizParams {
  lesson_content: string;
  lesson_name?: string;
  agency_id: string | null;
  question_count?: number;
}

export function useGenerateSPQuiz() {
  return useMutation({
    mutationFn: async ({ lesson_content, lesson_name, agency_id, question_count }: GenerateSPQuizParams) => {
      const { data, error } = await supabase.functions.invoke('generate-training-content', {
        body: { mode: 'generate_quiz', lesson_content, lesson_name, agency_id, question_count },
      });

      if (error) {
        console.error('Edge function error:', error);
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      const questions: AIQuestion[] = data.questions;
      if (!questions || questions.length === 0) {
        throw new Error('No questions were generated');
      }

      // Transform AI format → SP quiz JSON format
      const spQuestions: SPQuizQuestion[] = questions.map((q, i) => ({
        id: `q_${Date.now()}_${i}`,
        question: q.question_text,
        options: q.options.map(o => o.option_text),
        correct_index: q.options.findIndex(o => o.is_correct),
      }));

      return spQuestions;
    },
    onSuccess: (result) => {
      toast.success(`${result.length} quiz questions generated`);
    },
    onError: (error) => {
      console.error('Generate SP quiz error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate quiz');
    },
  });
}

export function useRewriteLessonContent() {
  return useMutation({
    mutationFn: async ({ existing_content, rewrite_mode, agency_id }: RewriteContentParams) => {
      const { data, error } = await supabase.functions.invoke('generate-training-content', {
        body: { mode: 'rewrite_content', existing_content, rewrite_mode, agency_id },
      });

      if (error) {
        console.error('Edge function error:', error);
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      return data.content_html as string;
    },
    onSuccess: () => {
      toast.success('Content rewritten');
    },
    onError: (error) => {
      console.error('Rewrite content error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to rewrite content');
    },
  });
}
