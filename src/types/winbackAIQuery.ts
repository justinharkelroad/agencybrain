/** Extended filter dimensions for AI-only filters (client-side) — Win-Back Opportunities */
export interface AIWinbackExtendedFilters {
  premiumMin?: number;
  premiumMax?: number;
  policyCountMin?: number;
  policyCountMax?: number;
  city?: string[];
  state?: string[];
  zipCode?: string[];
  assignedTeamMemberId?: string | 'unassigned';
}

/** Full set of filters the AI can produce — Win-Back Opportunities */
export interface AIWinbackFilters extends AIWinbackExtendedFilters {
  statusFilter?: 'all' | 'untouched' | 'in_progress' | 'won_back' | 'dismissed' | 'declined' | 'no_contact';
  activeTab?: 'active' | 'dismissed';
  quickDateFilter?: 'all' | 'overdue' | 'this_week' | 'next_2_weeks' | 'next_month';
  dateRangeStart?: string;
  dateRangeEnd?: string;
  search?: string;
}

export interface AIWinbackSortCriteria {
  column: string;
  direction: 'asc' | 'desc';
}

export interface AIWinbackQueryResponse {
  filters: AIWinbackFilters;
  sort?: AIWinbackSortCriteria;
  summary: string;
  tip?: string;
}

/** Extended filter dimensions for AI-only filters (client-side) — Termination Analysis */
export interface AITerminationExtendedFilters {
  premiumMin?: number;
  premiumMax?: number;
  itemsCountMin?: number;
  itemsCountMax?: number;
  originalYearMin?: number;
  originalYearMax?: number;
  productName?: string[];
  agentNumber?: string[];
  terminationReason?: string[];
}

/** Full set of filters the AI can produce — Termination Analysis */
export interface AITerminationFilters extends AITerminationExtendedFilters {
  search?: string;
  hideCancelRewrites?: boolean;
  activeTab?: 'leaderboard' | 'all' | 'by-type' | 'by-reason' | 'by-origin' | 'by-source';
  dateRangeStart?: string;
  dateRangeEnd?: string;
}

export interface AITerminationSortCriteria {
  column: string;
  direction: 'asc' | 'desc';
}

export interface AITerminationQueryResponse {
  filters: AITerminationFilters;
  sort?: AITerminationSortCriteria;
  summary: string;
  tip?: string;
}

/** Shared conversation message type */
export interface AIWinbackConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}
