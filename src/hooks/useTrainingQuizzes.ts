import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface TrainingQuiz {
  id: string;
  agency_id: string;
  lesson_id: string;
  name: string;
  description: string | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
  questions?: TrainingQuizQuestion[];
}

export interface TrainingQuizQuestion {
  id: string;
  quiz_id: string;
  question_text: string;
  question_type: "multiple_choice" | "true_false";
  sort_order: number | null;
  created_at: string;
  options?: TrainingQuizOption[];
}

export interface TrainingQuizOption {
  id: string;
  question_id: string;
  option_text: string;
  is_correct: boolean | null;
  sort_order: number | null;
}

export interface QuizWithQuestionsInsert {
  quiz: {
    lesson_id: string;
    agency_id: string;
    name: string;
    description?: string;
    is_active?: boolean;
  };
  questions: {
    question_text: string;
    question_type: "multiple_choice" | "true_false";
    sort_order: number;
    options: {
      option_text: string;
      is_correct: boolean;
      sort_order: number;
    }[];
  }[];
}

export function useTrainingQuizzes(lessonId?: string, agencyId?: string) {
  const queryClient = useQueryClient();

  // Fetch quizzes with questions and options for a lesson
  const {
    data: quizzes = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["training-quizzes", lessonId],
    queryFn: async () => {
      if (!lessonId) return [];

      // Fetch quizzes
      const { data: quizzesData, error: quizzesError } = await supabase
        .from("training_quizzes")
        .select("*")
        .eq("lesson_id", lessonId)
        .order("created_at", { ascending: true });

      if (quizzesError) throw quizzesError;

      // Fetch all questions and options for these quizzes
      const quizIds = quizzesData.map((q) => q.id);
      if (quizIds.length === 0) return [];

      const { data: questionsData, error: questionsError } = await supabase
        .from("training_quiz_questions")
        .select("*")
        .in("quiz_id", quizIds)
        .order("sort_order", { ascending: true });

      if (questionsError) throw questionsError;

      const questionIds = questionsData.map((q) => q.id);
      const { data: optionsData, error: optionsError } = await supabase
        .from("training_quiz_options")
        .select("*")
        .in("question_id", questionIds)
        .order("sort_order", { ascending: true });

      if (optionsError) throw optionsError;

      // Assemble nested structure
      const quizzesWithQuestions = quizzesData.map((quiz) => {
        const questions = questionsData
          .filter((q) => q.quiz_id === quiz.id)
          .map((question) => ({
            ...question,
            options: optionsData.filter((o) => o.question_id === question.id),
          }));

        return {
          ...quiz,
          questions,
        };
      });

      return quizzesWithQuestions as TrainingQuiz[];
    },
    enabled: !!lessonId,
  });

  // Create quiz with questions and options
  const createQuizWithQuestions = useMutation({
    mutationFn: async (data: QuizWithQuestionsInsert) => {
      // 1. Create quiz
      const { data: quizData, error: quizError } = await supabase
        .from("training_quizzes")
        .insert(data.quiz)
        .select()
        .single();

      if (quizError) throw quizError;

      // 2. Create questions
      const questionsToInsert = data.questions.map((q) => ({
        quiz_id: quizData.id,
        question_text: q.question_text,
        question_type: q.question_type,
        sort_order: q.sort_order,
      }));

      const { data: questionsData, error: questionsError } = await supabase
        .from("training_quiz_questions")
        .insert(questionsToInsert)
        .select();

      if (questionsError) throw questionsError;

      // 3. Create options
      const optionsToInsert = questionsData.flatMap((question, qIdx) => {
        return data.questions[qIdx].options.map((opt) => ({
          question_id: question.id,
          option_text: opt.option_text,
          is_correct: opt.is_correct,
          sort_order: opt.sort_order,
        }));
      });

      const { error: optionsError } = await supabase
        .from("training_quiz_options")
        .insert(optionsToInsert);

      if (optionsError) throw optionsError;

      return quizData;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["training-quizzes", data.lesson_id] });
      toast.success("Quiz created successfully");
    },
    onError: (error: any) => {
      console.error("Create quiz error:", error);
      toast.error(error.message || "Failed to create quiz");
    },
  });

  // Delete quiz (cascade will handle questions and options)
  const deleteQuiz = useMutation({
    mutationFn: async (quizId: string) => {
      const { error } = await supabase
        .from("training_quizzes")
        .delete()
        .eq("id", quizId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training-quizzes"] });
      toast.success("Quiz deleted");
    },
    onError: (error: any) => {
      console.error("Delete quiz error:", error);
      toast.error(error.message || "Failed to delete quiz");
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
