export interface FlowProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  preferred_name: string | null;
  life_roles: string[];
  core_values: string[];
  current_goals: string | null;
  current_challenges: string | null;
  spiritual_beliefs: string | null;
  faith_tradition: string | null;
  background_notes: string | null;
  // New coaching depth fields
  accountability_style: string | null;
  feedback_preference: string | null;
  peak_state: string | null;
  growth_edge: string | null;
  overwhelm_response: string | null;
  created_at: string;
  updated_at: string;
}

export interface FlowQuestion {
  id: string;
  type: 'text' | 'textarea' | 'select';
  prompt: string;
  required: boolean;
  options?: string[];
  placeholder?: string;
  interpolation_key?: string;
  ai_challenge?: boolean;
  show_if?: {
    question_id: string;
    equals: string;
  };
}

export interface FlowTemplate {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  questions_json: FlowQuestion[];
  ai_challenge_enabled: boolean;
  ai_challenge_intensity: string;
  ai_analysis_prompt: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface FlowSession {
  id: string;
  user_id: string;
  flow_template_id: string;
  title: string | null;
  domain: string | null;
  responses_json: Record<string, string>;
  ai_analysis_json: FlowAnalysis | null;
  status: 'in_progress' | 'completed';
  completed_at: string | null;
  pdf_url: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  flow_template?: FlowTemplate;
}

export interface FlowAnalysis {
  headline: string;
  congratulations: string;
  deep_dive_insight: string;
  connections: string[];
  themes: string[];
  provocative_question: string;
  suggested_action: string | null;
}

export interface FlowChallengeLog {
  id: string;
  session_id: string;
  question_id: string;
  original_response: string;
  ai_challenge: string;
  user_action: 'revised' | 'skipped';
  revised_response: string | null;
  created_at: string;
}
