// Renewal Tool TypeScript Types
// Following Cancel Audit patterns

// Renewal status values from CHECK constraint
export type RenewalStatus = 'upcoming' | 'contacted' | 'quoted' | 'retained' | 'lost';

// Workflow status values from CHECK constraint  
export type WorkflowStatus = 'new' | 'in_progress' | 'resolved' | 'lost';

// Account type values from CHECK constraint
export type AccountType = 'personal' | 'commercial';

// Activity type values from CHECK constraint
export type ActivityType = 'status_change' | 'assignment' | 'note' | 'contact_attempt' | 'quote_sent' | 'follow_up_scheduled';

// Activity status labels for display
export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  status_change: 'Status Changed',
  assignment: 'Assigned',
  note: 'Note Added',
  contact_attempt: 'Contact Attempted',
  quote_sent: 'Quote Sent',
  follow_up_scheduled: 'Follow-up Scheduled',
};

// Activity colors for styling
export const ACTIVITY_COLORS: Record<ActivityType, string> = {
  status_change: 'bg-blue-100 text-blue-800',
  assignment: 'bg-purple-100 text-purple-800',
  note: 'bg-gray-100 text-gray-800',
  contact_attempt: 'bg-yellow-100 text-yellow-800',
  quote_sent: 'bg-green-100 text-green-800',
  follow_up_scheduled: 'bg-orange-100 text-orange-800',
};

// Renewal upload record
export interface RenewalUpload {
  id: string;
  agency_id: string;
  uploaded_by_user_id: string | null;
  uploaded_by_staff_id: string | null;
  uploaded_by_name: string;
  file_name: string | null;
  records_processed: number;
  records_created: number;
  records_updated: number;
  created_at: string;
}

// Renewal record from database
export interface RenewalRecord {
  id: string;
  agency_id: string;
  policy_number: string;
  household_key: string;
  insured_first_name: string | null;
  insured_last_name: string | null;
  insured_email: string | null;
  insured_phone: string | null;
  insured_phone_alt: string | null;
  agent_number: string | null;
  product_name: string | null;
  premium_cents: number | null;
  no_of_items: number | null;
  account_type: AccountType | null;
  renewal_effective_date: string | null;
  renewal_status: RenewalStatus;
  current_status: WorkflowStatus;
  assigned_to: string | null;
  is_active: boolean;
  last_upload_id: string | null;
  created_at: string;
  updated_at: string;
}

// Renewal activity record
export interface RenewalActivity {
  id: string;
  agency_id: string;
  record_id: string;
  household_key: string;
  activity_type: ActivityType;
  notes: string | null;
  user_id: string | null;
  staff_member_id: string | null;
  user_display_name: string;
  created_at: string;
}

// Parsed record from Excel upload (before database insert)
export interface ParsedRenewalRecord {
  policy_number: string;
  household_key: string;
  insured_first_name: string | null;
  insured_last_name: string | null;
  insured_email: string | null;
  insured_phone: string | null;
  insured_phone_alt: string | null;
  agent_number: string | null;
  product_name: string | null;
  premium_cents: number | null;
  no_of_items: number | null;
  account_type: AccountType | null;
  renewal_effective_date: string | null;
}

// Upload context - passed to upload hook (matches Cancel Audit pattern)
export interface RenewalUploadContext {
  agencyId: string;
  userId: string | null;
  staffMemberId: string | null;
  displayName: string;
}
