import { supabase } from '@/integrations/supabase/client';
import { formatCentsToCurrency, formatDate } from '@/lib/cancel-audit-utils';

interface ExportOptions {
  agencyId: string;
  viewMode: 'needs_attention' | 'all';
  reportTypeFilter: 'all' | 'cancellation' | 'pending_cancel';
  searchQuery: string;
  statusFilter?: 'all' | 'new' | 'in_progress' | 'resolved' | 'lost';
  includeActivities?: boolean;
}

export async function exportRecordsToCSV(options: ExportOptions): Promise<string> {
  const { agencyId, viewMode, reportTypeFilter, searchQuery, statusFilter = 'all', includeActivities = false } = options;

  // Fetch records with same filters as the list
  let query = supabase
    .from('cancel_audit_records')
    .select('*')
    .eq('agency_id', agencyId);

  // Apply view mode filtering
  if (viewMode === 'needs_attention') {
    query = query.eq('is_active', true).in('status', ['new', 'in_progress']);
  }
  // 'all' mode includes everything (active and inactive)

  if (reportTypeFilter !== 'all') {
    query = query.eq('report_type', reportTypeFilter);
  }

  if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }

  if (searchQuery.trim()) {
    const search = searchQuery.trim().toLowerCase();
    query = query.or(`insured_first_name.ilike.%${search}%,insured_last_name.ilike.%${search}%,policy_number.ilike.%${search}%`);
  }

  const { data: records, error } = await query.order('insured_last_name');

  if (error) throw error;
  if (!records || records.length === 0) throw new Error('No records to export');

  // Fetch activities if requested
  const activitiesByRecord: Map<string, number> = new Map();
  if (includeActivities) {
    const { data: activities } = await supabase
      .from('cancel_audit_activities')
      .select('record_id, activity_type')
      .eq('agency_id', agencyId);

    // Count contacts per record
    const contactTypes = ['attempted_call', 'voicemail_left', 'text_sent', 'email_sent', 'spoke_with_client'];
    activities?.forEach(a => {
      if (contactTypes.includes(a.activity_type)) {
        const count = activitiesByRecord.get(a.record_id) || 0;
        activitiesByRecord.set(a.record_id, count + 1);
      }
    });
  }

  // Build CSV
  const headers = [
    'Last Name',
    'First Name',
    'Policy Number',
    'Product',
    'Report Type',
    'Status',
    'Phone',
    'Phone Alt',
    'Email',
    'Agent #',
    'Premium',
    'Amount Due',
    'Cancel Date',
    'Pending Cancel Date',
    'Renewal Date',
    'Items',
    'Account Type',
    ...(includeActivities ? ['Contact Count'] : []),
  ];

  const rows = records.map(record => [
    record.insured_last_name || '',
    record.insured_first_name || '',
    record.policy_number || '',
    record.product_name || '',
    record.report_type === 'cancellation' ? 'Cancelled' : 'Pending Cancel',
    record.status.charAt(0).toUpperCase() + record.status.slice(1).replace('_', ' '),
    record.insured_phone || '',
    record.insured_phone_alt || '',
    record.insured_email || '',
    record.agent_number || '',
    formatCentsToCurrency(record.premium_cents),
    record.amount_due_cents ? formatCentsToCurrency(record.amount_due_cents) : '',
    record.cancel_date ? formatDate(record.cancel_date) : '',
    record.pending_cancel_date ? formatDate(record.pending_cancel_date) : '',
    record.renewal_effective_date ? formatDate(record.renewal_effective_date) : '',
    record.no_of_items?.toString() || '1',
    record.account_type || '',
    ...(includeActivities ? [activitiesByRecord.get(record.id)?.toString() || '0'] : []),
  ]);

  // Escape CSV values
  const escapeCSV = (value: string) => {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  const csv = [
    headers.join(','),
    ...rows.map(row => row.map(escapeCSV).join(','))
  ].join('\n');

  return csv;
}

export async function exportSummaryReport(
  agencyId: string,
  weekStart: string,
  weekEnd: string
): Promise<string> {
  // Fetch all data needed for summary
  const { data: records } = await supabase
    .from('cancel_audit_records')
    .select('*')
    .eq('agency_id', agencyId)
    .eq('is_active', true);

  const { data: activities } = await supabase
    .from('cancel_audit_activities')
    .select('*')
    .eq('agency_id', agencyId)
    .gte('created_at', weekStart)
    .lte('created_at', weekEnd);

  // Calculate stats
  const totalRecords = records?.length || 0;
  const pendingCount = records?.filter(r => r.report_type === 'pending_cancel').length || 0;
  const cancelledCount = records?.filter(r => r.report_type === 'cancellation').length || 0;

  const contactTypes = ['attempted_call', 'voicemail_left', 'text_sent', 'email_sent', 'spoke_with_client'];
  const contacts = activities?.filter(a => contactTypes.includes(a.activity_type)) || [];
  const uniqueHouseholds = new Set(contacts.map(a => a.household_key)).size;

  const paymentsMade = activities?.filter(a => a.activity_type === 'payment_made').length || 0;
  const paymentsPromised = activities?.filter(a => a.activity_type === 'payment_promised').length || 0;

  const recordsWithPayment = new Set(
    activities?.filter(a => a.activity_type === 'payment_made').map(a => a.record_id) || []
  );
  const premiumRecovered = records
    ?.filter(r => recordsWithPayment.has(r.id))
    .reduce((sum, r) => sum + (r.premium_cents || 0), 0) || 0;

  // Team breakdown
  const teamMap = new Map<string, { contacts: number; payments: number }>();
  activities?.forEach(a => {
    const name = a.user_display_name;
    if (!teamMap.has(name)) {
      teamMap.set(name, { contacts: 0, payments: 0 });
    }
    const stats = teamMap.get(name)!;
    if (contactTypes.includes(a.activity_type)) stats.contacts++;
    if (a.activity_type === 'payment_made') stats.payments++;
  });

  // Build report text
  const report = `
CANCEL AUDIT WEEKLY SUMMARY REPORT
==================================
Week: ${formatDate(weekStart)} - ${formatDate(weekEnd)}
Generated: ${new Date().toLocaleString()}

RECORDS OVERVIEW
----------------
Total Records: ${totalRecords}
  - Pending Cancel: ${pendingCount}
  - Cancelled: ${cancelledCount}

ACTIVITY THIS WEEK
------------------
Total Contacts Made: ${contacts.length}
Unique Households Contacted: ${uniqueHouseholds}
Coverage: ${totalRecords > 0 ? Math.round((uniqueHouseholds / totalRecords) * 100) : 0}%

WINS
----
Payments Made: ${paymentsMade}
Payments Promised: ${paymentsPromised}
Premium Recovered: ${formatCentsToCurrency(premiumRecovered)}

TEAM BREAKDOWN
--------------
${Array.from(teamMap.entries())
  .sort((a, b) => b[1].contacts - a[1].contacts)
  .map(([name, stats]) => `${name}: ${stats.contacts} contacts, ${stats.payments} payments`)
  .join('\n') || 'No activity recorded'}

STATUS BREAKDOWN
----------------
New: ${records?.filter(r => r.status === 'new').length || 0}
In Progress: ${records?.filter(r => r.status === 'in_progress').length || 0}
Resolved: ${records?.filter(r => r.status === 'resolved').length || 0}
Lost: ${records?.filter(r => r.status === 'lost').length || 0}
`.trim();

  return report;
}
