// Source modules for activity attribution
export type SourceModule = 'lqs' | 'renewal' | 'cancel_audit' | 'winback' | 'phone_system' | 'manual' | 'call_scoring';

// Activity types
export type ContactActivityType =
  | 'call'
  | 'email'
  | 'note'
  | 'appointment'
  | 'status_change'
  | 'voicemail'
  | 'text'
  | 'policy_sold'
  | 'policy_cancelled'
  | 'policy_renewed'
  | 'account_saved'
  | 'call_scored';

// Call directions
export type CallDirection = 'inbound' | 'outbound';

// Call outcomes
export type CallOutcome =
  | 'answered'
  | 'no_answer'
  | 'left_voicemail'
  | 'busy'
  | 'wrong_number'
  | 'disconnected';

// Customer lifecycle stages
export type LifecycleStage = 'open_lead' | 'quoted' | 'customer' | 'renewal' | 'winback' | 'cancel_audit';

// Contact record from agency_contacts table
export interface Contact {
  id: string;
  agency_id: string;
  first_name: string;
  last_name: string;
  household_key: string;
  phones: string[];
  emails: string[];
  street_address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  created_at: string;
  updated_at: string;
}

// Contact with computed current status
export interface ContactWithStatus extends Contact {
  current_stage: LifecycleStage;
  last_activity_at: string | null;
  last_activity_type: ContactActivityType | null;
}

// Activity record from contact_activities table
export interface ContactActivity {
  id: string;
  contact_id: string;
  agency_id: string;
  source_module: SourceModule;
  source_record_id: string | null;
  activity_type: ContactActivityType;
  activity_subtype: string | null;
  activity_date: string;
  phone_number: string | null;
  call_direction: CallDirection | null;
  call_duration_seconds: number | null;
  call_recording_url: string | null;
  outcome: string | null;
  subject: string | null;
  notes: string | null;
  created_by_user_id: string | null;
  created_by_staff_id: string | null;
  created_by_display_name: string | null;
  created_at: string;
  updated_at: string;
}

// ==================== Detail Types for Nested Records ====================

// LQS Quote detail (from lqs_quotes table)
export interface LqsQuoteDetail {
  id: string;
  quote_date: string;
  product_type: string;
  items_quoted: number;
  premium_cents: number;
  issued_policy_number: string | null;
}

// LQS Sale detail (from lqs_sales table)
export interface LqsSaleDetail {
  id: string;
  sale_date: string;
  product_type: string;
  items_sold: number;
  policies_sold: number;
  premium_cents: number;
  policy_number: string | null;
}

// Winback Policy detail (from winback_policies table)
export interface WinbackPolicyDetail {
  id: string;
  policy_number: string;
  product_name: string | null;
  product_code: string | null;
  termination_effective_date: string | null;
  termination_reason: string | null;
  premium_old_cents: number | null;
  premium_new_cents: number | null;
  premium_change_percent: number | null;
  calculated_winback_date: string | null;
}

// ==================== Linked Record Summaries for Profile View ====================

export interface LinkedLQSRecord {
  id: string;
  status: string | null;
  quoted_premium: number | null;
  sold_date: string | null;
  team_member_name: string | null;
  created_at: string;
  // Extended fields
  lead_source_name: string | null;
  quotes: LqsQuoteDetail[];
  sales: LqsSaleDetail[];
}

export interface LinkedRenewalRecord {
  id: string;
  policy_number: string;
  renewal_effective_date: string;
  renewal_status: string | null;
  current_status: string;
  premium_new: number | null;
  assigned_team_member_name: string | null;
  // Extended fields
  premium_old: number | null;
  premium_change_percent: number | null;
  product_name: string | null;
  amount_due: number | null;
  easy_pay: boolean | null;
  multi_line_indicator: boolean | null;
}

export interface LinkedCancelAuditRecord {
  id: string;
  cancel_status: string | null;
  cancel_reason: string | null;
  resolution: string | null;
  assigned_team_member_name: string | null;
  created_at: string;
  // Extended fields
  policy_number: string | null;
  product_name: string | null;
  premium_cents: number | null;
  amount_due_cents: number | null;
  cancel_date: string | null;
  pending_cancel_date: string | null;
  account_type: string | null;
}

export interface LinkedWinbackRecord {
  id: string;
  status: string | null;
  termination_date: string | null;
  earliest_winback_date: string | null;
  assigned_team_member_name: string | null;
  // Extended fields
  policies: WinbackPolicyDetail[];
}

// Full contact profile with all linked records
export interface ContactProfile extends Contact {
  current_stage: LifecycleStage;
  activities: ContactActivity[];
  lqs_records: LinkedLQSRecord[];
  renewal_records: LinkedRenewalRecord[];
  cancel_audit_records: LinkedCancelAuditRecord[];
  winback_records: LinkedWinbackRecord[];
}

// Journey event for timeline visualization
export interface JourneyEvent {
  stage: LifecycleStage;
  date: string;
  label: string;
  source_module: SourceModule;
  source_record_id: string | null;
}

// Context passed to contact profile modal
export interface ContactProfileContext {
  agencyId: string;
  userId: string | null;
  staffMemberId: string | null;
  displayName: string;
  sourceModule: SourceModule;
  sourceRecordId?: string;
}

// Filters for contact list
export interface ContactFilters {
  search?: string;
  stage?: LifecycleStage[];
  hasActivity?: boolean;
  sortBy?: 'name' | 'last_activity' | 'created_at';
  sortDirection?: 'asc' | 'desc';
}

// Activity log form data
export interface ActivityLogFormData {
  activity_type: ContactActivityType;
  source_module: SourceModule;
  outcome?: string;
  subject?: string;
  notes?: string;
  call_direction?: CallDirection;
  scheduled_date?: string;
}

// Source module display configuration
export interface SourceModuleConfig {
  key: SourceModule;
  label: string;
  icon: string;
  color: string;
  bgColor: string;
}

// Module configs for display
export const SOURCE_MODULE_CONFIGS: Record<SourceModule, SourceModuleConfig> = {
  lqs: {
    key: 'lqs',
    label: 'LQS',
    icon: '📊',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  renewal: {
    key: 'renewal',
    label: 'Renewals',
    icon: '🔄',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
  },
  cancel_audit: {
    key: 'cancel_audit',
    label: 'Cancel Audit',
    icon: '⚠️',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
  },
  winback: {
    key: 'winback',
    label: 'Winback',
    icon: '🎯',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
  },
  phone_system: {
    key: 'phone_system',
    label: 'Phone',
    icon: '📞',
    color: 'text-gray-600',
    bgColor: 'bg-gray-50',
  },
  manual: {
    key: 'manual',
    label: 'Manual',
    icon: '📝',
    color: 'text-gray-600',
    bgColor: 'bg-gray-50',
  },
  call_scoring: {
    key: 'call_scoring',
    label: 'Call Score',
    icon: '🎯',
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
  },
};

// Lifecycle stage display configuration
export const LIFECYCLE_STAGE_CONFIGS: Record<LifecycleStage, { label: string; icon: string; color: string }> = {
  open_lead: { label: 'Open Lead', icon: '🆕', color: 'text-blue-600' },
  quoted: { label: 'Quoted HH', icon: '📋', color: 'text-cyan-600' },
  customer: { label: 'Customer', icon: '✅', color: 'text-green-600' },
  renewal: { label: 'Renewal', icon: '🔄', color: 'text-yellow-600' },
  winback: { label: 'Winback', icon: '🎯', color: 'text-purple-600' },
  cancel_audit: { label: 'Cancel Status', icon: '⚠️', color: 'text-orange-600' },
};
