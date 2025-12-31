export type RenewalStatus = 'Renewal Taken' | 'Renewal Not Taken' | 'Pending' | string;
export type WorkflowStatus = 'uncontacted' | 'pending' | 'success' | 'unsuccessful';
export type AccountType = 'PL' | 'CL' | string;
export type ActivityType = 'phone_call' | 'appointment' | 'email' | 'note' | 'status_change';
export type ActivityStatus = 'called_no_answer' | 'called_left_message' | 'appointment_scheduled' | 'appointment_scheduled_not_discussed' | 'activity_complete_success' | 'activity_complete_unsuccessful';

export interface RenewalUpload {
  id: string; agency_id: string; filename: string; uploaded_by: string | null;
  uploaded_by_display_name: string | null; record_count: number;
  date_range_start: string | null; date_range_end: string | null; created_at: string;
}

export interface RenewalRecord {
  id: string; agency_id: string; upload_id: string; last_upload_id: string;
  policy_number: string; renewal_effective_date: string;
  first_name: string | null; last_name: string | null; email: string | null;
  phone: string | null; phone_alt: string | null; product_name: string | null;
  agent_number: string | null; renewal_status: RenewalStatus | null;
  account_type: AccountType | null; premium_old: number | null; premium_new: number | null;
  premium_change_dollars: number | null; premium_change_percent: number | null;
  amount_due: number | null; easy_pay: boolean; multi_line_indicator: boolean;
  item_count: number | null; years_prior_insurance: number | null;
  household_key: string | null; current_status: WorkflowStatus;
  assigned_team_member_id: string | null; notes: string | null;
  last_activity_at: string | null; last_activity_by: string | null;
  last_activity_by_display_name: string | null; uploaded_by: string | null;
  uploaded_by_display_name: string | null; is_active: boolean;
  created_at: string; updated_at: string;
  assigned_team_member?: { id: string; name: string } | null;
}

export interface RenewalActivity {
  id: string; renewal_record_id: string; agency_id: string; activity_type: ActivityType;
  activity_status: ActivityStatus | null; subject: string | null; comments: string | null;
  scheduled_date: string | null; send_calendar_invite: boolean; completed_date: string | null;
  assigned_team_member_id: string | null; created_by: string | null;
  created_by_display_name: string | null; created_at: string;
  assigned_team_member?: { id: string; name: string } | null;
}

export interface ParsedRenewalRecord {
  policyNumber: string; renewalEffectiveDate: string; firstName: string | null;
  lastName: string | null; email: string | null; phone: string | null;
  phoneAlt: string | null; productName: string | null; agentNumber: string | null;
  renewalStatus: string | null; accountType: string | null; premiumOld: number | null;
  premiumNew: number | null; premiumChangeDollars: number | null;
  premiumChangePercent: number | null; amountDue: number | null; easyPay: boolean;
  multiLineIndicator: boolean; itemCount: number | null; yearsPriorInsurance: number | null;
  householdKey: string | null;
}

export interface RenewalUploadContext {
  agencyId: string; userId: string | null; staffMemberId: string | null; displayName: string;
}
