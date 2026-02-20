/** Extended filter dimensions for AI-only filters (client-side) */
export interface AICancelAuditExtendedFilters {
  // Premium range (client-side, in dollars — page converts to cents)
  premiumMin?: number;
  premiumMax?: number;
  // Premium change range (in dollars, calculated: premium_new - premium_old)
  premiumChangeMin?: number;
  premiumChangeMax?: number;
  // Original year range
  originalYearMin?: string;
  originalYearMax?: string;
  // Enrichment-based filters
  productName?: string[];
  agentNumber?: string[];
  city?: string[];
  state?: string[];
  zipCode?: string[];
  companyCode?: string[];
  // Assignment
  assignedTeamMemberId?: string | 'unassigned';
}

/** Full set of filters the AI can produce */
export interface AICancelAuditFilters extends AICancelAuditExtendedFilters {
  // Existing page-level filters
  reportType?: 'all' | 'cancellation' | 'pending_cancel';
  cancelStatus?: string;
  workflowStatus?: string;
  search?: string;
  // Toggle overrides
  showUntouchedOnly?: boolean;
  showCurrentOnly?: boolean;
  showDroppedOnly?: boolean;
  // Urgency
  urgencyFilter?: string;
}

export interface AICancelAuditSortCriteria {
  column: string;
  direction: 'asc' | 'desc';
}

export interface AICancelAuditQueryResponse {
  filters: AICancelAuditFilters;
  sort?: AICancelAuditSortCriteria;
  viewMode?: 'needs_attention' | 'all';
  summary: string;
  tip?: string;
}

export interface AICancelAuditConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}
