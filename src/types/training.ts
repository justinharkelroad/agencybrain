// Training Module Types - exact match with database schema (snake_case)

export interface TrainingCategory {
  id: string;
  agency_id: string;
  name: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TrainingLesson {
  id: string;
  agency_id: string;
  category_id: string;
  title: string;
  description: string | null;
  content_type: 'video' | 'pdf' | 'both';
  video_url: string | null;
  pdf_url: string | null;
  display_order: number;
  is_active: boolean;
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
  display_order: number;
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
  staff_user_id: string;
  quiz_id: string;
  selected_answer: string;
  is_correct: boolean;
  attempted_at: string;
  created_at: string;
}

// Insert types (omit auto-generated fields)
export type TrainingCategoryInsert = Omit<TrainingCategory, 'id' | 'created_at' | 'updated_at'> & {
  display_order?: number;
  is_active?: boolean;
};

export type TrainingLessonInsert = Omit<TrainingLesson, 'id' | 'created_at' | 'updated_at'> & {
  display_order?: number;
  is_active?: boolean;
  description?: string | null;
  video_url?: string | null;
  pdf_url?: string | null;
};

export type TrainingQuizInsert = Omit<TrainingQuiz, 'id' | 'created_at' | 'updated_at'>;

export type TrainingLessonCompletionInsert = Omit<TrainingLessonCompletion, 'id' | 'created_at'>;

export type TrainingQuizAttemptInsert = Omit<TrainingQuizAttempt, 'id' | 'created_at'>;

// Update types (all fields optional except id)
export type TrainingCategoryUpdate = Partial<Omit<TrainingCategory, 'id' | 'created_at' | 'updated_at'>>;

export type TrainingLessonUpdate = Partial<Omit<TrainingLesson, 'id' | 'created_at' | 'updated_at'>>;
