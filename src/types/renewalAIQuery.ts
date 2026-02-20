import type { WorkflowStatus } from './renewal';

/** Extended filter dimensions that AI can set beyond existing RenewalFilters */
export interface AIExtendedFilters {
  // Range filters
  premiumChangePercentMin?: number;
  premiumChangePercentMax?: number;
  premiumNewMin?: number;
  premiumNewMax?: number;
  amountDueMin?: number;
  amountDueMax?: number;
  // Geo filters (server-side)
  zipCode?: string[];
  city?: string[];
  state?: string[];
  // Other
  carrierStatus?: string[];
  agentNumber?: string[];
}

/** Full set of filters the AI can produce */
export interface AIRenewalFilters extends AIExtendedFilters {
  // Existing filter dimensions
  currentStatus?: WorkflowStatus[];
  renewalStatus?: string[];
  productName?: string[];
  bundledStatus?: 'all' | 'bundled' | 'monoline' | 'unknown';
  accountType?: string[];
  assignedTeamMemberId?: string | 'unassigned';
  dateRangeStart?: string;
  dateRangeEnd?: string;
  search?: string;
  // Toggle overrides
  showPriorityOnly?: boolean;
  hideRenewalTaken?: boolean;
  hideInCancelAudit?: boolean;
  showFirstTermOnly?: boolean;
  showDroppedOnly?: boolean;
}

export interface AISortCriteria {
  column: string;
  direction: 'asc' | 'desc';
}

export interface AIQueryResponse {
  filters: AIRenewalFilters;
  sort?: AISortCriteria;
  activeTab?: string;
  summary: string;
  tip?: string;
}

export interface AIConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}
