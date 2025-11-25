// Training Module Types - exact match with database schema (snake_case)

export interface TrainingCategory {
  id: string;
  agency_id: string;
  name: string;
  description: string | null;
  sort_order: number | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
}

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
  estimated_duration_minutes: number | null;
  created_at: string;
  updated_at: string;
}

export interface TrainingQuiz {
  id: string;
  lesson_id: string;
  question_text: string;
  question_type: 'multiple_choice' | 'true_false';
  options_json: string[] | null;
  correct_answer: string;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
}

export interface TrainingLessonCompletion {
  id: string;
  staff_user_id: string;
  lesson_id: string;
  completed_at: string;
  created_at: string;
}

export interface TrainingQuizAttempt {
  id: string;
  agency_id: string;
  staff_user_id: string;
  quiz_id: string;
  score_percent: number;
  total_questions: number;
  correct_answers: number;
  answers_json: Record<string, any>;
  started_at: string;
  completed_at: string;
}

// Insert types (omit auto-generated fields, all nullable fields are optional)
export type TrainingCategoryInsert = {
  agency_id: string;
  name: string;
  description?: string | null;
  sort_order?: number | null;
  is_active?: boolean | null;
};

export type TrainingLessonInsert = {
  agency_id: string;
  module_id: string;
  name: string;
  description?: string | null;
  video_url?: string | null;
  video_platform?: string | null;
  content_html?: string | null;
  sort_order?: number | null;
  is_active?: boolean | null;
  estimated_duration_minutes?: number | null;
};

export type TrainingQuizInsert = Omit<TrainingQuiz, 'id' | 'created_at' | 'updated_at'>;

export type TrainingLessonCompletionInsert = Omit<TrainingLessonCompletion, 'id' | 'created_at'>;

export type TrainingQuizAttemptInsert = Omit<TrainingQuizAttempt, 'id'>;

// Update types (all fields optional except id)
export type TrainingCategoryUpdate = Partial<Omit<TrainingCategory, 'id' | 'created_at' | 'updated_at'>>;

export type TrainingLessonUpdate = Partial<Omit<TrainingLesson, 'id' | 'created_at' | 'updated_at'>>;
