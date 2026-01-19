import { supabase } from '@/integrations/supabase/client';
import { getStaffToken, hasStaffToken } from './staffRequest';
import { startOfWeek, endOfWeek } from 'date-fns';
import type { DateRange } from 'react-day-picker';

// Types
export interface WinbackStats {
  totalHouseholds: number;
  untouched: number;
  inProgress: number;
  wonBack: number;
  dismissed: number;
  teedUpThisWeek: number;
}

export interface WinbackHousehold {
  id: string;
  agency_id: string;
  household_key: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  street_address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  status: 'untouched' | 'in_progress' | 'won_back' | 'dismissed';
  assigned_to: string | null;
  assigned_name?: string | null;
  notes: string | null;
  earliest_winback_date: string | null;
  contact_id: string | null;
  policy_count: number;
  total_premium_potential_cents: number;
  created_at: string;
  updated_at: string;
}

export interface WinbackPolicy {
  id: string;
  policy_number: string;
  product_name: string | null;
  product_code: string | null;
  policy_term_months: number | null;
  termination_effective_date: string | null;
  termination_reason: string | null;
  premium_old_cents: number | null;
  premium_new_cents: number | null;
  calculated_winback_date: string | null;
  account_type: string | null;
}

export interface WinbackActivity {
  id: string;
  activity_type: string;
  notes: string | null;
  created_by_name: string | null;
  old_status: string | null;
  new_status: string | null;
  created_at: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email?: string;
}

interface ListHouseholdsParams {
  agencyId: string;
  activeTab: 'active' | 'dismissed';
  search: string;
  statusFilter: string;
  dateRange?: DateRange;
  sortColumn: string;
  sortDirection: 'asc' | 'desc';
  currentPage: number;
  pageSize: number;
}

interface UploadStats {
  processed: number;
  newHouseholds: number;
  newPolicies: number;
  updated: number;
  skipped: number;
}

// Helper to call staff edge function
async function callStaffWinback<T>(operation: string, params: Record<string, any> = {}): Promise<T> {
  const token = getStaffToken();
  if (!token) throw new Error('No staff token');

  const response = await supabase.functions.invoke('get_staff_winback', {
    body: { operation, params },
    headers: { 'x-staff-session': token },
  });

  if (response.error) throw response.error;
  return response.data as T;
}

// Check if current user is staff
export function isStaffUser(): boolean {
  return hasStaffToken();
}

// ============ Settings ============

export async function getSettings(agencyId: string): Promise<{ contact_days_before: number }> {
  if (isStaffUser()) {
    return callStaffWinback('get_settings', {});
  }

  const { data, error } = await supabase
    .from('winback_settings')
    .select('contact_days_before')
    .eq('agency_id', agencyId)
    .maybeSingle();

  if (error) throw error;
  return { contact_days_before: data?.contact_days_before ?? 45 };
}

export async function saveSettings(agencyId: string, contactDaysBefore: number): Promise<void> {
  if (isStaffUser()) {
    await callStaffWinback('save_settings', { contact_days_before: contactDaysBefore });
    return;
  }

  const { error } = await supabase
    .from('winback_settings')
    .upsert({
      agency_id: agencyId,
      contact_days_before: contactDaysBefore,
    }, { onConflict: 'agency_id' });

  if (error) throw error;
}

// ============ Team Members ============

export async function listTeamMembers(agencyId: string): Promise<TeamMember[]> {
  if (isStaffUser()) {
    const result = await callStaffWinback<{ members: TeamMember[] }>('list_team_members', {});
    return result.members;
  }

  const { data, error } = await supabase
    .from('team_members')
    .select('id, name, email')
    .eq('agency_id', agencyId)
    .eq('status', 'active')
    .order('name');

  if (error) throw error;
  return data || [];
}

// ============ Stats ============

export async function getStats(agencyId: string): Promise<WinbackStats> {
  if (isStaffUser()) {
    return callStaffWinback('get_stats', {});
  }

  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

  const [totalRes, untouchedRes, inProgressRes, wonBackRes, dismissedRes, teedUpRes] =
    await Promise.all([
      supabase
        .from('winback_households')
        .select('id', { count: 'exact', head: true })
        .eq('agency_id', agencyId)
        .neq('status', 'dismissed'),
      supabase
        .from('winback_households')
        .select('id', { count: 'exact', head: true })
        .eq('agency_id', agencyId)
        .eq('status', 'untouched'),
      supabase
        .from('winback_households')
        .select('id', { count: 'exact', head: true })
        .eq('agency_id', agencyId)
        .eq('status', 'in_progress'),
      supabase
        .from('winback_households')
        .select('id', { count: 'exact', head: true })
        .eq('agency_id', agencyId)
        .eq('status', 'won_back'),
      supabase
        .from('winback_households')
        .select('id', { count: 'exact', head: true })
        .eq('agency_id', agencyId)
        .eq('status', 'dismissed'),
      supabase
        .from('winback_households')
        .select('id', { count: 'exact', head: true })
        .eq('agency_id', agencyId)
        .neq('status', 'dismissed')
        .gte('earliest_winback_date', weekStart.toISOString())
        .lte('earliest_winback_date', weekEnd.toISOString()),
    ]);

  return {
    totalHouseholds: totalRes.count || 0,
    untouched: untouchedRes.count || 0,
    inProgress: inProgressRes.count || 0,
    wonBack: wonBackRes.count || 0,
    dismissed: dismissedRes.count || 0,
    teedUpThisWeek: teedUpRes.count || 0,
  };
}

// ============ Households ============

export async function listHouseholds(params: ListHouseholdsParams): Promise<{ households: WinbackHousehold[]; count: number }> {
  if (isStaffUser()) {
    return callStaffWinback('list_households', {
      activeTab: params.activeTab,
      search: params.search,
      statusFilter: params.statusFilter,
      dateRange: params.dateRange ? {
        from: params.dateRange.from?.toISOString(),
        to: params.dateRange.to?.toISOString(),
      } : undefined,
      sortColumn: params.sortColumn,
      sortDirection: params.sortDirection,
      currentPage: params.currentPage,
      pageSize: params.pageSize,
    });
  }

  let query = supabase
    .from('winback_households')
    .select('*', { count: 'exact' })
    .eq('agency_id', params.agencyId);

  // Tab filter
  if (params.activeTab === 'dismissed') {
    query = query.eq('status', 'dismissed');
  } else {
    query = query.neq('status', 'dismissed');
    query = query.not('earliest_winback_date', 'is', null);
  }

  // Status filter
  if (params.statusFilter !== 'all') {
    query = query.eq('status', params.statusFilter);
  }

  // Date range filter
  if (params.dateRange?.from) {
    query = query.gte('earliest_winback_date', params.dateRange.from.toISOString());
  }
  if (params.dateRange?.to) {
    query = query.lte('earliest_winback_date', params.dateRange.to.toISOString());
  }

  // Search filter
  if (params.search) {
    const searchLower = params.search.toLowerCase();
    query = query.or(
      `first_name.ilike.%${searchLower}%,last_name.ilike.%${searchLower}%,phone.ilike.%${searchLower}%,email.ilike.%${searchLower}%`
    );
  }

  // Sorting
  const sortColumnMap: Record<string, string> = {
    name: 'last_name',
    policy_count: 'policy_count',
    total_premium_potential_cents: 'total_premium_potential_cents',
    earliest_winback_date: 'earliest_winback_date',
    status: 'status',
    assigned_name: 'assigned_to',
  };
  query = query.order(sortColumnMap[params.sortColumn] || 'earliest_winback_date', { ascending: params.sortDirection === 'asc' });

  // Pagination
  const from = (params.currentPage - 1) * params.pageSize;
  const to = from + params.pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;

  return { households: (data || []) as WinbackHousehold[], count: count || 0 };
}

// ============ Household Details ============

export async function getHouseholdDetails(householdId: string): Promise<{ policies: WinbackPolicy[]; activities: WinbackActivity[] }> {
  if (isStaffUser()) {
    return callStaffWinback('get_household_details', { householdId });
  }

  const [policiesRes, activitiesRes] = await Promise.all([
    supabase
      .from('winback_policies')
      .select('*')
      .eq('household_id', householdId)
      .order('calculated_winback_date', { ascending: true }),
    supabase
      .from('winback_activities')
      .select('*')
      .eq('household_id', householdId)
      .order('created_at', { ascending: false }),
  ]);

  if (policiesRes.error) throw policiesRes.error;
  if (activitiesRes.error) throw activitiesRes.error;

  return {
    policies: policiesRes.data || [],
    activities: activitiesRes.data || [],
  };
}

// ============ Activity Logging ============

export async function logActivity(
  householdId: string,
  agencyId: string,
  activityType: string,
  notes: string,
  currentUserTeamMemberId: string | null,
  teamMembers: TeamMember[]
): Promise<void> {
  if (isStaffUser()) {
    await callStaffWinback('log_activity', { householdId, activityType, notes });
    return;
  }

  const userName = teamMembers.find(m => m.id === currentUserTeamMemberId)?.name || 'Unknown';

  const { error } = await supabase
    .from('winback_activities')
    .insert({
      household_id: householdId,
      agency_id: agencyId,
      activity_type: activityType,
      notes: notes || null,
      created_by_user_id: null,
      created_by_team_member_id: currentUserTeamMemberId || null,
      created_by_name: userName,
    });

  if (error) throw error;
}

// ============ Status Updates ============

export async function updateHouseholdStatus(
  householdId: string,
  agencyId: string,
  newStatus: string,
  oldStatus: string,
  currentUserTeamMemberId: string | null,
  teamMembers: TeamMember[],
  assignedTo: string | null
): Promise<{ success: boolean; assigned_to?: string }> {
  if (isStaffUser()) {
    return callStaffWinback('update_household_status', {
      householdId,
      newStatus,
      oldStatus,
      currentUserTeamMemberId,
    });
  }

  const updateData: Record<string, any> = {
    status: newStatus,
    updated_at: new Date().toISOString(),
  };

  if (newStatus === 'in_progress' && !assignedTo && currentUserTeamMemberId) {
    updateData.assigned_to = currentUserTeamMemberId;
  }

  // Only update if old status matches (prevents overwriting won_back or in_progress)
  const { error: updateError, count } = await supabase
    .from('winback_households')
    .update(updateData)
    .eq('id', householdId)
    .eq('status', oldStatus);

  if (updateError) throw updateError;

  // If no rows were updated (status didn't match), return failure
  if (count === 0) return { success: false, assigned_to: undefined };

  // Log status change
  const userName = teamMembers.find(m => m.id === currentUserTeamMemberId)?.name || 'Unknown';
  await supabase.from('winback_activities').insert({
    household_id: householdId,
    agency_id: agencyId,
    activity_type: 'status_change',
    old_status: oldStatus,
    new_status: newStatus,
    created_by_team_member_id: currentUserTeamMemberId || null,
    created_by_name: userName,
  });

  return { success: true, assigned_to: updateData.assigned_to };
}

// ============ Assignment ============

export async function updateAssignment(
  householdId: string,
  assignedTo: string,
  currentStatus: string
): Promise<{ newStatus?: string }> {
  if (isStaffUser()) {
    return callStaffWinback('update_assignment', { householdId, assignedTo });
  }

  const updateData: Record<string, any> = {
    assigned_to: assignedTo === 'unassigned' ? null : assignedTo,
    updated_at: new Date().toISOString(),
  };

  if (assignedTo && assignedTo !== 'unassigned' && currentStatus === 'untouched') {
    updateData.status = 'in_progress';
  }

  const { error } = await supabase
    .from('winback_households')
    .update(updateData)
    .eq('id', householdId);

  if (error) throw error;
  return { newStatus: updateData.status };
}

// ============ Push to Next Cycle ============

export async function pushToNextCycle(
  householdId: string,
  agencyId: string,
  contactDaysBefore: number,
  currentUserTeamMemberId: string | null,
  teamMembers: TeamMember[]
): Promise<void> {
  if (isStaffUser()) {
    await callStaffWinback('push_to_next_cycle', {
      householdId,
      contactDaysBefore,
      currentUserTeamMemberId,
    });
    return;
  }

  // Get policies
  const { data: policies, error: fetchError } = await supabase
    .from('winback_policies')
    .select('id, policy_term_months, termination_effective_date')
    .eq('household_id', householdId);

  if (fetchError) throw fetchError;
  if (!policies || policies.length === 0) throw new Error('No policies found');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const policy of policies) {
    const terminationDate = new Date(policy.termination_effective_date);
    const policyTermMonths = policy.policy_term_months || 12;

    let competitorRenewalDate = new Date(terminationDate);
    competitorRenewalDate.setMonth(competitorRenewalDate.getMonth() + policyTermMonths);

    while (competitorRenewalDate <= today) {
      competitorRenewalDate.setMonth(competitorRenewalDate.getMonth() + policyTermMonths);
    }

    competitorRenewalDate.setMonth(competitorRenewalDate.getMonth() + policyTermMonths);

    const newWinbackDate = new Date(competitorRenewalDate);
    newWinbackDate.setDate(newWinbackDate.getDate() - contactDaysBefore);

    await supabase
      .from('winback_policies')
      .update({ calculated_winback_date: newWinbackDate.toISOString().split('T')[0] })
      .eq('id', policy.id);
  }

  // Recalculate aggregates
  const { error: rpcError } = await supabase.rpc('recalculate_winback_household_aggregates', {
    p_household_id: householdId,
  });

  if (rpcError) {
    const { data: updatedPolicies } = await supabase
      .from('winback_policies')
      .select('calculated_winback_date')
      .eq('household_id', householdId)
      .order('calculated_winback_date', { ascending: true })
      .limit(1);

    if (updatedPolicies && updatedPolicies.length > 0) {
      await supabase
        .from('winback_households')
        .update({ earliest_winback_date: updatedPolicies[0].calculated_winback_date })
        .eq('id', householdId);
    }
  }

  await supabase
    .from('winback_households')
    .update({
      status: 'untouched',
      assigned_to: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', householdId);

  // Log the action
  const userName = teamMembers.find(m => m.id === currentUserTeamMemberId)?.name || 'Unknown';
  await supabase.from('winback_activities').insert({
    household_id: householdId,
    agency_id: agencyId,
    activity_type: 'note',
    notes: 'Pushed to next renewal cycle',
    created_by_team_member_id: currentUserTeamMemberId || null,
    created_by_name: userName,
  });
}

// ============ Permanent Delete ============

export async function permanentDeleteHousehold(householdId: string): Promise<void> {
  if (isStaffUser()) {
    await callStaffWinback('permanent_delete_household', { householdId });
    return;
  }

  // Delete policies
  await supabase
    .from('winback_policies')
    .delete()
    .eq('household_id', householdId);

  // Delete activities
  await supabase
    .from('winback_activities')
    .delete()
    .eq('household_id', householdId);

  // Clear renewal_records references
  await supabase
    .from('renewal_records')
    .update({ winback_household_id: null, sent_to_winback_at: null })
    .eq('winback_household_id', householdId);

  // Delete household
  const { error } = await supabase
    .from('winback_households')
    .delete()
    .eq('id', householdId);

  if (error) throw error;
}

// ============ Activity Stats ============

export async function getActivityStats(agencyId: string, weekStart: Date, weekEnd: Date): Promise<{
  called: number;
  left_vm: number;
  texted: number;
  emailed: number;
  quoted: number;
  total: number;
}> {
  if (isStaffUser()) {
    return callStaffWinback('get_activity_stats', {
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
    });
  }

  const { data, error } = await supabase
    .from('winback_activities')
    .select('activity_type')
    .eq('agency_id', agencyId)
    .in('activity_type', ['called', 'left_vm', 'texted', 'emailed', 'quoted'])
    .gte('created_at', weekStart.toISOString())
    .lte('created_at', weekEnd.toISOString());

  if (error) throw error;

  const counts = {
    called: 0,
    left_vm: 0,
    texted: 0,
    emailed: 0,
    quoted: 0,
    total: 0,
  };

  data?.forEach((row) => {
    const type = row.activity_type as keyof Omit<typeof counts, 'total'>;
    if (type in counts) {
      counts[type]++;
      counts.total++;
    }
  });

  return counts;
}

// Get weekly won back count
export async function getWeeklyWonBackCount(agencyId: string, weekStart: Date, weekEnd: Date): Promise<number> {
  if (isStaffUser()) {
    const result = await callStaffWinback<{ count: number }>('get_weekly_won_back', {
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
    });
    return result.count;
  }

  const { count, error } = await supabase
    .from('winback_households')
    .select('id', { count: 'exact', head: true })
    .eq('agency_id', agencyId)
    .eq('status', 'won_back')
    .gte('updated_at', weekStart.toISOString())
    .lte('updated_at', weekEnd.toISOString());

  if (error) throw error;
  return count || 0;
}

// ============ Activity Summary ============

export async function getActivitySummary(agencyId: string, dateStr: string): Promise<WinbackActivity[]> {
  if (isStaffUser()) {
    const result = await callStaffWinback<{ activities: WinbackActivity[] }>('get_activity_summary', { dateStr });
    return result.activities;
  }

  const selectedDate = new Date(dateStr);
  const localStart = new Date(selectedDate);
  localStart.setHours(0, 0, 0, 0);
  const localEnd = new Date(localStart);
  localEnd.setHours(23, 59, 59, 999);

  const { data, error } = await supabase
    .from('winback_activities')
    .select('id, activity_type, created_by_name, new_status, created_at')
    .eq('agency_id', agencyId)
    .gte('created_at', localStart.toISOString())
    .lte('created_at', localEnd.toISOString());

  if (error) throw error;
  return data || [];
}

// ============ Upload Terminations ============

export async function uploadTerminations(
  agencyId: string,
  records: any[],
  filename: string,
  contactDaysBefore: number,
  userId?: string
): Promise<UploadStats> {
  if (isStaffUser()) {
    return callStaffWinback('upload_terminations', { records, filename, contactDaysBefore });
  }

  // For non-staff, use the existing direct approach
  // This keeps the existing behavior for agency owners
  throw new Error('Use WinbackUploadModal direct implementation for non-staff users');
}

// ============ Termination Analytics ============

export interface TerminationTeamMember {
  id: string;
  name: string;
  agent_number: string | null;
  sub_producer_code: string | null;
}

export interface TerminationPolicy {
  id: string;
  policy_number: string;
  agent_number: string | null;
  product_name: string | null;
  line_code: string | null;
  items_count: number | null;
  premium_new_cents: number | null;
  termination_effective_date: string;
  termination_reason: string | null;
  is_cancel_rewrite: boolean | null;
  household_id: string;
  winback_households?: {
    first_name: string;
    last_name: string;
  };
}

export async function getTerminationTeamMembers(agencyId: string): Promise<TerminationTeamMember[]> {
  if (isStaffUser()) {
    const result = await callStaffWinback<{ members: TerminationTeamMember[] }>('get_termination_team_members', {});
    return result.members;
  }

  const { data, error } = await supabase
    .from('team_members')
    .select('id, name, agent_number, sub_producer_code')
    .eq('agency_id', agencyId);

  if (error) throw error;
  return data || [];
}

export async function getTerminationPolicies(
  agencyId: string,
  dateFrom?: string,
  dateTo?: string
): Promise<TerminationPolicy[]> {
  if (isStaffUser()) {
    const result = await callStaffWinback<{ policies: TerminationPolicy[] }>('get_termination_policies', {
      dateFrom,
      dateTo,
    });
    return result.policies;
  }

  let query = supabase
    .from('winback_policies')
    .select(`
      id,
      policy_number,
      agent_number,
      product_name,
      line_code,
      items_count,
      premium_new_cents,
      termination_effective_date,
      termination_reason,
      is_cancel_rewrite,
      household_id,
      winback_households!inner (
        first_name,
        last_name
      )
    `)
    .eq('agency_id', agencyId)
    .order('termination_effective_date', { ascending: false });

  if (dateFrom) {
    query = query.gte('termination_effective_date', dateFrom);
  }
  if (dateTo) {
    query = query.lte('termination_effective_date', dateTo);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as TerminationPolicy[];
}
