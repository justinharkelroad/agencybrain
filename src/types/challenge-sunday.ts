export interface SundayModule {
  id: string;
  challenge_product_id: string;
  sunday_number: number;
  title: string;
  blurb_html: string | null;
  video_url: string | null;
  video_thumbnail_url: string | null;
  has_rating_section: boolean;
  has_commitment_section: boolean;
  has_final_reflection: boolean;
  final_reflection_prompt: string | null;
  // Computed by get-staff-challenge
  is_unlocked: boolean;
  is_completed: boolean;
  response: SundayResponse | null;
  previous_commitments: {
    body: string | null;
    being: string | null;
    balance: string | null;
    business: string | null;
  } | null;
}

export interface SundayResponse {
  id: string;
  assignment_id: string;
  sunday_module_id: string;
  staff_user_id: string;
  sunday_number: number;
  rating_body: number | null;
  rating_being: number | null;
  rating_balance: number | null;
  rating_business: number | null;
  accomplished_body: boolean | null;
  accomplished_being: boolean | null;
  accomplished_balance: boolean | null;
  accomplished_business: boolean | null;
  commitment_body: string | null;
  commitment_being: string | null;
  commitment_balance: string | null;
  commitment_business: string | null;
  final_reflection: string | null;
  completed_at: string;
}

export type Core4Domain = 'body' | 'being' | 'balance' | 'business';

export const CORE4_DOMAINS: { key: Core4Domain; label: string; icon: string }[] = [
  { key: 'body', label: 'Body', icon: '💪' },
  { key: 'being', label: 'Being', icon: '🧠' },
  { key: 'balance', label: 'Balance', icon: '⚖️' },
  { key: 'business', label: 'Business', icon: '📈' },
];
