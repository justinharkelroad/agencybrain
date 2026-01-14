export type ReportType = 'cancellation' | 'pending_cancel';

export type RecordStatus = 'new' | 'in_progress' | 'resolved' | 'lost';

export type ActivityType = 
  | 'attempted_call'
  | 'voicemail_left'
  | 'text_sent'
  | 'email_sent'
  | 'spoke_with_client'
  | 'payment_made'
  | 'payment_promised'
  | 'note';

export interface CancelAuditRecord {
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
  premium_cents: number;
  no_of_items: number;
  account_type: string | null;
  report_type: ReportType;
  amount_due_cents: number | null;
  cancel_date: string | null;
  renewal_effective_date: string | null;
  pending_cancel_date: string | null;
  cancel_status: string | null;
  status: RecordStatus;
  is_active: boolean;
  last_upload_id: string | null;
  assigned_team_member_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CancelAuditActivity {
  id: string;
  agency_id: string;
  record_id: string;
  household_key: string;
  user_id: string | null;
  staff_member_id: string | null;
  user_display_name: string;
  activity_type: ActivityType;
  notes: string | null;
  created_at: string;
}

export interface CancelAuditUpload {
  id: string;
  agency_id: string;
  uploaded_by_user_id: string | null;
  uploaded_by_staff_id: string | null;
  uploaded_by_name: string;
  report_type: ReportType;
  file_name: string | null;
  records_processed: number;
  records_created: number;
  records_updated: number;
  created_at: string;
}

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  attempted_call: 'Attempted Call',
  voicemail_left: 'Voicemail Left',
  text_sent: 'Text Sent',
  email_sent: 'Email Sent',
  spoke_with_client: 'Spoke With Client',
  payment_made: 'Payment Made',
  payment_promised: 'Payment Promised',
  note: 'Note Added'
};

export const ACTIVITY_COLORS: Record<ActivityType, string> = {
  attempted_call: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  voicemail_left: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  text_sent: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  email_sent: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  spoke_with_client: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
  payment_made: 'bg-green-500/10 text-green-500 border-green-500/20',
  payment_promised: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  note: 'bg-gray-500/10 text-gray-400 border-gray-500/20'
};
