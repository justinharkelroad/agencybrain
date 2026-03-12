import { supabase } from '@/integrations/supabase/client';
import { hasStaffToken, fetchWithAuth } from './staffRequest';
import { startOfDay, startOfWeek, endOfWeek, format, subDays } from 'date-fns';
import { generateHouseholdKey } from './lqs-quote-parser';
import { classifyBundle } from './bundle-classifier';
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
  status: 'untouched' | 'in_progress' | 'won_back' | 'dismissed' | 'moved_to_quoted' | 'declined' | 'no_contact';
  assigned_to: string | null;
  assigned_name?: string | null;
  notes: string | null;
  earliest_winback_date: string | null;
  latest_non_rewrite_termination_date: string | null;
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
  terminationAgeFilter: 'all' | '0_30' | '31_60' | '61_120' | '121_plus';
  dateRange?: DateRange;
  sortColumn: string;
  sortDirection: 'asc' | 'desc';
  currentPage: number;
  pageSize: number;
}

function getTerminationAgeDateRange(filter: ListHouseholdsParams['terminationAgeFilter']) {
  if (filter === 'all') return null;

  const today = startOfDay(new Date());

  switch (filter) {
    case '0_30':
      return { from: subDays(today, 30), to: today };
    case '31_60':
      return { from: subDays(today, 60), to: subDays(today, 31) };
    case '61_120':
      return { from: subDays(today, 120), to: subDays(today, 61) };
    case '121_plus':
      return { to: subDays(today, 121) };
    default:
      return null;
  }
}

interface UploadStats {
  processed: number;
  newHouseholds: number;
  totalHouseholds: number;
  newPolicies: number;
  updated: number;
  skipped: number;
  crossMatch?: {
    cancel_audit_linked: number;
    cancel_audit_demoted: number;
    renewals_linked: number;
    renewals_demoted: number;
    contacts_linked: number;
  };
}

// Helper to call staff edge function using fetchWithAuth to avoid invalid JWT issues
async function callStaffWinback<T>(operation: string, params: Record<string, any> = {}): Promise<T> {
  const response = await fetchWithAuth('get_staff_winback', {
    method: 'POST',
    prefer: 'auto',
    body: { operation, params },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }

  return await response.json() as T;
}

async function hasStaffWinbackAccess(): Promise<boolean> {
  if (hasStaffToken()) return true;

  const { data: { session } } = await supabase.auth.getSession();
  return !!session;
}

// Check if current user is staff
// Check if current user should use staff API path
export function isStaffUser(): boolean {
  const hasToken = hasStaffToken();
  if (!hasToken) return false;

  const staffTokenExpiresAt = (() => {
    try {
      const expiry = window.localStorage.getItem("staff_session_expiry");
      return expiry ? new Date(expiry) : null;
    } catch {
      return null;
    }
  })();

  if (staffTokenExpiresAt && Number.isNaN(staffTokenExpiresAt.getTime())) return true;
  if (staffTokenExpiresAt) return staffTokenExpiresAt.getTime() > Date.now();

  return true;
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

  // Recalculate winback dates on all existing policies
  const { error: recalcError } = await supabase
    .rpc('recalculate_winback_dates', {
      p_agency_id: agencyId,
      p_contact_days_before: contactDaysBefore,
    });

  if (recalcError) {
    console.error('Failed to recalculate winback dates:', recalcError);
  }
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
        .neq('status', 'dismissed')
        .neq('status', 'moved_to_quoted')
        .not('earliest_winback_date', 'is', null),
      supabase
        .from('winback_households')
        .select('id', { count: 'exact', head: true })
        .eq('agency_id', agencyId)
        .eq('status', 'untouched')
        .not('earliest_winback_date', 'is', null),
      supabase
        .from('winback_households')
        .select('id', { count: 'exact', head: true })
        .eq('agency_id', agencyId)
        .eq('status', 'in_progress')
        .not('earliest_winback_date', 'is', null),
      supabase
        .from('winback_households')
        .select('id', { count: 'exact', head: true })
        .eq('agency_id', agencyId)
        .eq('status', 'won_back')
        .not('earliest_winback_date', 'is', null),
      supabase
        .from('winback_households')
        .select('id', { count: 'exact', head: true })
        .eq('agency_id', agencyId)
        .eq('status', 'dismissed')
        .not('earliest_winback_date', 'is', null),
      supabase
        .from('winback_households')
        .select('id', { count: 'exact', head: true })
        .eq('agency_id', agencyId)
        .neq('status', 'dismissed')
        .neq('status', 'moved_to_quoted')
        .gte('earliest_winback_date', format(weekStart, 'yyyy-MM-dd'))
        .lte('earliest_winback_date', format(weekEnd, 'yyyy-MM-dd')),
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
      terminationAgeFilter: params.terminationAgeFilter,
      dateRange: params.dateRange ? {
        from: params.dateRange.from ? format(params.dateRange.from, 'yyyy-MM-dd') : undefined,
        to: params.dateRange.to ? format(params.dateRange.to, 'yyyy-MM-dd') : undefined,
      } : undefined,
      sortColumn: params.sortColumn,
      sortDirection: params.sortDirection,
      currentPage: params.currentPage,
      pageSize: params.pageSize,
    });
  }

  let query = supabase
    .from('winback_households')
    .select('*, winback_policies(product_name), winback_activities(count)', { count: 'exact' })
    .eq('agency_id', params.agencyId)
    .in('winback_activities.activity_type', ['called', 'left_vm', 'texted', 'emailed']);

  query = query.not('earliest_winback_date', 'is', null);

  // Tab filter
  if (params.activeTab === 'dismissed') {
    query = query.eq('status', 'dismissed');
  } else {
    query = query.neq('status', 'dismissed').neq('status', 'moved_to_quoted');
  }

  // Status filter
  if (params.statusFilter !== 'all') {
    query = query.eq('status', params.statusFilter);
  }

  // Date range filter — earliest_winback_date is a DATE column, use YYYY-MM-DD strings
  // (not .toISOString() which shifts to UTC and breaks date comparisons for western timezones)
  if (params.dateRange?.from) {
    query = query.gte('earliest_winback_date', format(params.dateRange.from, 'yyyy-MM-dd'));
  }
  if (params.dateRange?.to) {
    query = query.lte('earliest_winback_date', format(params.dateRange.to, 'yyyy-MM-dd'));
  }

  const terminationAgeRange = getTerminationAgeDateRange(params.terminationAgeFilter);
  if (terminationAgeRange?.from) {
    query = query.gte('latest_non_rewrite_termination_date', format(terminationAgeRange.from, 'yyyy-MM-dd'));
  }
  if (terminationAgeRange?.to) {
    query = query.lte('latest_non_rewrite_termination_date', format(terminationAgeRange.to, 'yyyy-MM-dd'));
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

  // Also log to unified contact_activities for Contacts page "Last Activity"
  try {
    const { data: household } = await supabase
      .from('winback_households')
      .select('contact_id')
      .eq('id', householdId)
      .single();
    
    if (household?.contact_id) {
      await supabase.rpc('insert_contact_activity', {
        p_agency_id: agencyId,
        p_contact_id: household.contact_id,
        p_source_module: 'winback',
        p_activity_type: activityType,
        p_source_record_id: householdId,
        p_notes: notes || null,
        p_created_by_display_name: userName,
      });
    }
  } catch (unifiedErr) {
    console.warn('Failed to log to unified contact_activities:', unifiedErr);
  }

  // Dispatch event for immediate UI updates (fallback if Realtime is slow/broken)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('winback:activity_logged', {
      detail: { agencyId, activityType, householdId }
    }));
  }
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
  } else if (newStatus === 'untouched') {
    updateData.assigned_to = null;
  }

  // Only update if old status matches (prevents overwriting won_back or in_progress)
  // IMPORTANT: Use { count: 'exact' } to get actual row count (Supabase JS v2 returns null otherwise)
  const { data: updatedRows, error: updateError, count } = await supabase
    .from('winback_households')
    .update(updateData, { count: 'exact' })
    .eq('id', householdId)
    .eq('status', oldStatus)
    .select('id');

  if (updateError) throw updateError;

  // If no rows were updated (status didn't match), return failure
  // With count: 'exact', count will be 0 (not null) when no rows match
  if (count === 0 || !updatedRows || updatedRows.length === 0) {
    console.log('[winbackApi] Status update failed - no rows matched', { householdId, oldStatus, newStatus });
    return { success: false, assigned_to: undefined };
  }

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

/**
 * Transition a winback household to moved_to_quoted from ANY active status.
 * This is more robust than the two-step approach used elsewhere.
 * Also sets the assigned_to field to the current user if provided.
 */
export async function transitionToQuoted(
  householdId: string,
  agencyId: string,
  currentUserTeamMemberId: string | null,
  teamMembers: TeamMember[]
): Promise<{ success: boolean; previousStatus?: string }> {
  if (isStaffUser()) {
    return callStaffWinback('transition_to_quoted', {
      householdId,
      currentUserTeamMemberId,
    });
  }

  // Active statuses that can transition to moved_to_quoted
  const activeStatuses = ['untouched', 'in_progress', 'declined', 'no_contact'];

  const updateData: Record<string, any> = {
    status: 'moved_to_quoted',
    updated_at: new Date().toISOString(),
  };

  // Always set assigned_to when moving to quoted (shows who did it)
  if (currentUserTeamMemberId) {
    updateData.assigned_to = currentUserTeamMemberId;
  }

  // Update from any active status
  const { data: updatedRows, error: updateError, count } = await supabase
    .from('winback_households')
    .update(updateData, { count: 'exact' })
    .eq('id', householdId)
    .in('status', activeStatuses)
    .select('id');

  if (updateError) throw updateError;

  // If no rows were updated (not in an active status), return failure
  if (count === 0 || !updatedRows || updatedRows.length === 0) {
    console.log('[winbackApi] transitionToQuoted failed - no rows matched active statuses', { householdId, activeStatuses });
    return { success: false };
  }

  // Log the status change
  const userName = teamMembers.find(m => m.id === currentUserTeamMemberId)?.name || 'Unknown';
  await supabase.from('winback_activities').insert({
    household_id: householdId,
    agency_id: agencyId,
    activity_type: 'status_change',
    old_status: null, // We don't know the exact old status from the bulk update
    new_status: 'moved_to_quoted',
    created_by_team_member_id: currentUserTeamMemberId || null,
    created_by_name: userName,
  });

  return { success: true };
}

/**
 * Full flow for staff users to move winback to quoted:
 * 1. Find/create "Winback" lead source
 * 2. Create/update LQS household
 * 3. Update winback status to moved_to_quoted
 * 4. Log activities
 */
export async function winbackToQuoted(
  householdId: string,
  agencyId: string,
  contactId: string | null,
  firstName: string,
  lastName: string,
  zipCode: string,
  phones: string[],
  email: string | null,
  currentUserTeamMemberId: string | null,
  products?: Array<{ productType: string; items: number; premiumCents: number }>
): Promise<{ success: boolean; leadSourceId?: string; error?: string }> {
  if (isStaffUser()) {
    return callStaffWinback('winback_to_quoted', {
      householdId,
      contactId,
      firstName,
      lastName,
      zipCode,
      phones,
      email,
      currentUserTeamMemberId,
      products,
    });
  }

  // Non-staff users should use the existing flow in ContactProfileModal
  // This function is primarily for staff users
  throw new Error('winbackToQuoted is only available for staff users');
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

    const competitorRenewalDate = new Date(terminationDate);
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
      .select('calculated_winback_date, termination_effective_date, is_cancel_rewrite')
      .eq('household_id', householdId)
      .order('calculated_winback_date', { ascending: true })
      .limit(200);

    if (updatedPolicies && updatedPolicies.length > 0) {
      const actionablePolicies = updatedPolicies.filter((policy) => !policy.is_cancel_rewrite);
      const latestTerminationDate = actionablePolicies
        .map((policy) => policy.termination_effective_date)
        .filter(Boolean)
        .sort()
        .at(-1) || null;

      await supabase
        .from('winback_households')
        .update({
          earliest_winback_date: actionablePolicies[0]?.calculated_winback_date || null,
          latest_non_rewrite_termination_date: latestTerminationDate,
        })
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
  const { error: policiesError } = await supabase
    .from('winback_policies')
    .delete()
    .eq('household_id', householdId);
  if (policiesError) throw policiesError;

  // Delete activities
  const { error: activitiesError } = await supabase
    .from('winback_activities')
    .delete()
    .eq('household_id', householdId);
  if (activitiesError) throw activitiesError;

  // Clear renewal_records references
  const { error: renewalError } = await supabase
    .from('renewal_records')
    .update({ winback_household_id: null, sent_to_winback_at: null })
    .eq('winback_household_id', householdId);
  if (renewalError) throw renewalError;

  // Clear cancel_audit_records references
  const { error: cancelAuditError } = await supabase
    .from('cancel_audit_records')
    .update({ winback_household_id: null })
    .eq('winback_household_id', householdId);
  if (cancelAuditError) throw cancelAuditError;

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
  // Parse date string as local date (not UTC) to avoid timezone shift
  // new Date("YYYY-MM-DD") parses as UTC midnight — wrong for local day boundaries
  const [year, month, day] = dateStr.split('-').map(Number);
  const localStart = new Date(year, month - 1, day, 0, 0, 0, 0);
  const localEnd = new Date(year, month - 1, day, 23, 59, 59, 999);

  if (isStaffUser()) {
    // Send pre-computed ISO boundaries from the browser (correct local timezone)
    // instead of dateStr which the edge function would parse as UTC
    const result = await callStaffWinback<{ activities: WinbackActivity[] }>('get_activity_summary', {
      startISO: localStart.toISOString(),
      endISO: localEnd.toISOString(),
      dateStr, // fallback for old edge function versions during rolling deploy
    });
    return result.activities;
  }

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
  userId?: string,
  totalHouseholds?: number
): Promise<UploadStats> {
  if (isStaffUser()) {
    return callStaffWinback('upload_terminations', { records, filename, contactDaysBefore, totalHouseholds });
  }

  // For non-staff, use the existing direct approach
  // This keeps the existing behavior for agency owners
  throw new Error('Use WinbackUploadModal direct implementation for non-staff users');
}

// Batch upload: process records without creating upload record (returns stats + IDs)
export async function uploadTerminationsBatch(
  records: any[],
  contactDaysBefore: number,
): Promise<UploadStats & { householdIds: string[]; policyIds: string[]; policyNumbers: string[] }> {
  return callStaffWinback('upload_terminations', {
    records,
    contactDaysBefore,
    skipUploadRecord: true,
  });
}

// Finalize a batched upload: create upload record and stamp IDs
export async function recordUpload(
  filename: string,
  totalStats: UploadStats,
  householdIds: string[],
  policyIds: string[],
  policyNumbers?: string[],
): Promise<{ success: boolean; uploadId?: string; crossMatch?: UploadStats['crossMatch'] }> {
  return callStaffWinback('record_upload', {
    filename,
    totalStats,
    householdIds,
    policyIds,
    policyNumbers,
  });
}

// ============ List Uploads ============

export async function listUploads(agencyId: string): Promise<any[]> {
  if (await hasStaffWinbackAccess()) {
    const result = await callStaffWinback<{ uploads: any[] }>('list_uploads', {});
    return result.uploads;
  }

  const { data, error } = await supabase
    .from('winback_uploads')
    .select('*')
    .eq('agency_id', agencyId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// ============ Delete Upload ============

export interface DeleteUploadResult {
  success: boolean;
  deleted: number;
  message?: string;
}

export async function deleteUpload(uploadId: string, agencyId: string): Promise<DeleteUploadResult> {
  if (await hasStaffWinbackAccess()) {
    const result = await callStaffWinback<DeleteUploadResult>(
      'delete_upload',
      { uploadId }
    );

    return result;
  }

  // Find all policies created by this upload (reliable link via source_upload_id)
  const { data: uploadPolicies, error: policiesFetchError } = await supabase
    .from('winback_policies')
    .select('id, household_id')
    .eq('source_upload_id', uploadId);

  if (policiesFetchError) throw policiesFetchError;

  const policyIdsToDelete: string[] = (uploadPolicies || []).map(p => p.id);
  const affectedHouseholdIds = new Set<string>(
    (uploadPolicies || []).map(p => p.household_id)
  );

  // For pre-migration uploads (before source_upload_id existed), use two fallbacks:
  // 1) last_upload_id on households (can be overwritten by later uploads)
  // 2) Timestamp-based matching: policies created during the upload's processing window
  if (policyIdsToDelete.length === 0) {
    // Fallback 1: households that still point to this upload
    const { data: fallbackHouseholds, error: fallbackError } = await supabase
      .from('winback_households')
      .select('id')
      .eq('last_upload_id', uploadId)
      .eq('agency_id', agencyId);

    if (fallbackError) {
      console.error('Fallback household lookup failed:', fallbackError);
    }
    for (const h of (fallbackHouseholds || [])) {
      affectedHouseholdIds.add(h.id);
    }

    // Fallback 2: timestamp-based matching for pre-migration data
    // Fetch the upload record to get its created_at timestamp
    const { data: uploadInfo, error: uploadInfoError } = await supabase
      .from('winback_uploads')
      .select('created_at')
      .eq('id', uploadId)
      .single();

    if (uploadInfoError) {
      console.error('Upload info fetch failed:', uploadInfoError);
    } else if (uploadInfo) {
      // The upload record is created AFTER all policies are inserted.
      // Policies were created within a window before the upload record's timestamp.
      // 30 min covers even very large uploads with network delays.
      const uploadTime = new Date(uploadInfo.created_at);
      const windowStart = new Date(uploadTime.getTime() - 30 * 60 * 1000);
      const windowEnd = new Date(uploadTime.getTime() + 60 * 1000);

      const { data: timestampPolicies, error: tsError } = await supabase
        .from('winback_policies')
        .select('id, household_id')
        .eq('agency_id', agencyId)
        .eq('source', 'csv_upload')
        .is('source_upload_id', null)
        .gte('created_at', windowStart.toISOString())
        .lte('created_at', windowEnd.toISOString());

      if (tsError) {
        console.error('Timestamp policy lookup failed:', tsError);
      }
      for (const p of (timestampPolicies || [])) {
        policyIdsToDelete.push(p.id);
        affectedHouseholdIds.add(p.household_id);
      }
    }
  }

  // Delete policies (chunked to avoid PostgREST request size limits)
  const chunkSize = 200;
  for (let i = 0; i < policyIdsToDelete.length; i += chunkSize) {
    const chunk = policyIdsToDelete.slice(i, i + chunkSize);
    const { error: policiesError } = await supabase
      .from('winback_policies')
      .delete()
      .in('id', chunk);
    if (policiesError) throw policiesError;
  }

  // For each affected household, check if it still has remaining policies
  const emptyHouseholdIds: string[] = [];
  for (const hhId of affectedHouseholdIds) {
    const { count } = await supabase
      .from('winback_policies')
      .select('id', { count: 'exact', head: true })
      .eq('household_id', hhId);

    if (count === 0) {
      emptyHouseholdIds.push(hhId);
    } else {
      // Recalculate aggregates for households that still have policies
      await supabase.rpc('recalculate_winback_household_aggregates', {
        p_household_id: hhId,
      });
    }
  }

  // Clean up empty households and their related data (chunked for large uploads)
  for (let i = 0; i < emptyHouseholdIds.length; i += chunkSize) {
    const hhChunk = emptyHouseholdIds.slice(i, i + chunkSize);

    await supabase
      .from('winback_activities')
      .delete()
      .in('household_id', hhChunk);

    await supabase
      .from('renewal_records')
      .update({ winback_household_id: null, sent_to_winback_at: null })
      .in('winback_household_id', hhChunk);

    await supabase
      .from('cancel_audit_records')
      .update({ winback_household_id: null })
      .in('winback_household_id', hhChunk);

    await supabase
      .from('winback_households')
      .delete()
      .in('id', hhChunk)
      .eq('agency_id', agencyId);
  }

  // Delete the upload record
  const { error } = await supabase
    .from('winback_uploads')
    .delete()
    .eq('id', uploadId);

  if (error) throw error;

  return {
    success: true,
    deleted: emptyHouseholdIds.length,
    message:
      policyIdsToDelete.length === 0 && emptyHouseholdIds.length === 0
        ? 'Upload removed from list, but no linked policies were found for that upload'
        : policyIdsToDelete.length > 0 && emptyHouseholdIds.length === 0
          ? `${policyIdsToDelete.length} policies removed. Households retained (they have policies from other sources).`
          : undefined,
  };
}

// ============ Bulk Delete Households ============

export async function bulkDeleteHouseholds(householdIds: string[]): Promise<void> {
  if (isStaffUser()) {
    await callStaffWinback('bulk_delete_households', { householdIds });
    return;
  }

  if (householdIds.length === 0) return;

  // Delete policies
  const { error: policiesError } = await supabase
    .from('winback_policies')
    .delete()
    .in('household_id', householdIds);
  if (policiesError) throw policiesError;

  // Delete activities
  const { error: activitiesError } = await supabase
    .from('winback_activities')
    .delete()
    .in('household_id', householdIds);
  if (activitiesError) throw activitiesError;

  // Clear renewal_records references
  const { error: renewalError } = await supabase
    .from('renewal_records')
    .update({ winback_household_id: null, sent_to_winback_at: null })
    .in('winback_household_id', householdIds);
  if (renewalError) throw renewalError;

  // Clear cancel_audit_records references
  const { error: cancelAuditError } = await supabase
    .from('cancel_audit_records')
    .update({ winback_household_id: null })
    .in('winback_household_id', householdIds);
  if (cancelAuditError) throw cancelAuditError;

  // Delete households
  const { error } = await supabase
    .from('winback_households')
    .delete()
    .in('id', householdIds);

  if (error) throw error;
}

// ============ Won Back Sale ============

export interface WonBackSalePolicy {
  productName: string;
  policyNumber: string | null;
  items: number;
  premium: number;
}

export async function recordWonBackSale(
  householdId: string,
  agencyId: string,
  household: {
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    email: string | null;
    zip_code: string | null;
    contact_id: string | null;
    status: string;
  },
  policies: WonBackSalePolicy[],
  saleDate: string,
  currentUserTeamMemberId: string | null,
  teamMembers: TeamMember[]
): Promise<{ success: boolean; saleId?: string; error?: string }> {
  if (isStaffUser()) {
    return callStaffWinback('record_won_back', {
      householdId,
      policies,
      saleDate,
    });
  }

  try {
    // Step 1: Find or create "Winback" lead source
    let winbackLeadSourceId: string | null = null;

    const { data: existingSource } = await supabase
      .from('lead_sources')
      .select('id')
      .eq('agency_id', agencyId)
      .ilike('name', 'winback')
      .limit(1)
      .maybeSingle();

    if (existingSource) {
      winbackLeadSourceId = existingSource.id;
    } else {
      const { data: newSource, error: createError } = await supabase
        .from('lead_sources')
        .insert({
          agency_id: agencyId,
          name: 'Winback',
          is_active: true,
          is_self_generated: false,
          cost_type: 'per_lead',
          cost_per_lead_cents: 0,
        })
        .select('id')
        .single();

      if (!createError && newSource) {
        winbackLeadSourceId = newSource.id;
      }
    }

    // Step 2: Compute totals from policy entries
    const totalPolicies = policies.length;
    const totalItems = policies.reduce((sum, p) => sum + Math.round(p.items), 0);
    const totalPremium = policies.reduce((sum, p) => sum + p.premium, 0);
    const customerName = `${household.first_name || ''} ${household.last_name || ''}`.trim() || 'Unknown';

    const bundle = classifyBundle({
      productNames: policies.map((p) => p.productName),
    });
    const bundleType = bundle.bundleType === 'Monoline' ? null : bundle.bundleType;

    // Step 3: Insert sales record
    const { data: saleRecord, error: saleError } = await supabase
      .from('sales')
      .insert({
        agency_id: agencyId,
        team_member_id: currentUserTeamMemberId || null,
        lead_source_id: winbackLeadSourceId,
        customer_name: customerName,
        customer_email: household.email || null,
        customer_phone: household.phone || null,
        customer_zip: household.zip_code || null,
        sale_date: saleDate,
        effective_date: saleDate,
        total_policies: totalPolicies,
        total_items: totalItems,
        total_premium: totalPremium,
        is_bundle: bundle.isBundle,
        bundle_type: bundleType,
        is_one_call_close: false,
        source: 'winback',
      })
      .select('id')
      .single();

    if (saleError || !saleRecord) {
      console.error('[recordWonBackSale] sale insert error:', saleError);
      return { success: false, error: saleError?.message || 'Failed to create sale' };
    }

    const saleId = saleRecord.id;

    // Step 4: Insert sale_policies and sale_items for each policy
    for (const policy of policies) {
      const itemCount = Math.round(policy.items); // Ensure integer for DB column

      const { data: salePolicyRecord, error: spError } = await supabase
        .from('sale_policies')
        .insert({
          sale_id: saleId,
          policy_type_name: policy.productName,
          effective_date: saleDate,
          total_items: itemCount,
          total_premium: policy.premium,
        })
        .select('id')
        .single();

      if (spError) {
        console.error('[recordWonBackSale] sale_policies insert error:', spError);
        continue;
      }

      // Insert sale_items
      const { error: siError } = await supabase
        .from('sale_items')
        .insert({
          sale_id: saleId,
          sale_policy_id: salePolicyRecord?.id || null,
          product_type_name: policy.productName,
          item_count: itemCount,
          premium: policy.premium,
        });

      if (siError) {
        console.error('[recordWonBackSale] sale_items insert error:', siError);
      }
    }

    // Step 5: Find or create contact and link to sale
    // Use freshly resolved contactId for the activity mirror (not the stale household.contact_id)
    let resolvedContactId: string | null = household.contact_id;
    try {
      const firstName = household.first_name || '';
      const lastName = household.last_name || '';
      const { data: contactId } = await supabase.rpc('find_or_create_contact', {
        p_agency_id: agencyId,
        p_first_name: firstName,
        p_last_name: lastName,
        p_zip_code: household.zip_code || undefined,
        p_phone: household.phone || undefined,
        p_email: household.email || undefined,
      });

      if (contactId) {
        resolvedContactId = contactId;
        await supabase
          .from('sales')
          .update({ contact_id: contactId })
          .eq('id', saleId)
          .is('contact_id', null);
      }
    } catch (contactErr) {
      console.warn('[recordWonBackSale] contact find/create error:', contactErr);
    }

    // Step 5b: Create/update LQS household record so won-back appears in dashboard quoted HH
    // Must happen BEFORE step 6 so the sync_winback_status_to_lqs trigger can promote it to 'sold'
    try {
      const householdKey = generateHouseholdKey(
        household.first_name || '',
        household.last_name || '',
        household.zip_code
      );

      let lqsHouseholdId: string | null = null;

      // Check if an LQS household already exists (avoid downgrading a 'sold' row to 'quoted')
      const { data: existingLqs } = await supabase
        .from('lqs_households')
        .select('id')
        .eq('agency_id', agencyId)
        .eq('household_key', householdKey)
        .maybeSingle();

      if (existingLqs) {
        lqsHouseholdId = existingLqs.id;
        // Ensure contact_id is set so the sync trigger can match it
        if (resolvedContactId) {
          await supabase
            .from('lqs_households')
            .update({ contact_id: resolvedContactId })
            .eq('id', existingLqs.id)
            .is('contact_id', null);
        }
      } else {
        // Create new household as 'quoted' — triggers quoted_count increment in metrics_daily
        const { data: newLqs } = await supabase
          .from('lqs_households')
          .insert({
            agency_id: agencyId,
            household_key: householdKey,
            first_name: (household.first_name || '').toUpperCase(),
            last_name: (household.last_name || '').toUpperCase(),
            zip_code: household.zip_code || '',
            contact_id: resolvedContactId,
            status: 'quoted',
            lead_source_id: winbackLeadSourceId,
            team_member_id: currentUserTeamMemberId || null,
            first_quote_date: saleDate,
            lead_received_date: saleDate,
            phone: household.phone ? [household.phone] : [],
            email: household.email || null,
          })
          .select('id')
          .single();

        if (newLqs) {
          lqsHouseholdId = newLqs.id;
        }
      }

      // Create quote rows for each policy sold
      if (lqsHouseholdId) {
        const quoteRows = policies.map(p => ({
          household_id: lqsHouseholdId!,
          agency_id: agencyId,
          team_member_id: currentUserTeamMemberId || null,
          quote_date: saleDate,
          product_type: p.productName,
          items_quoted: Math.round(p.items),
          premium_cents: Math.round(p.premium * 100),
          source: 'manual' as const,
        }));

        await supabase.from('lqs_quotes').insert(quoteRows);
      }
    } catch (lqsErr) {
      console.warn('[recordWonBackSale] LQS creation error:', lqsErr);
      // Non-critical — sale record and winback status update should still proceed
    }

    // Step 6: Update winback_households.status = 'won_back' (concurrency guard)
    // This fires sync_winback_status_to_lqs trigger which promotes the LQS household to 'sold'
    // Also set contact_id so the trigger can match the LQS household by contact_id
    const { count: updatedCount } = await supabase
      .from('winback_households')
      .update({
        status: 'won_back',
        ...(resolvedContactId ? { contact_id: resolvedContactId } : {}),
        updated_at: new Date().toISOString(),
      }, { count: 'exact' })
      .eq('id', householdId)
      .eq('status', household.status);

    if (updatedCount === 0) {
      console.warn('[recordWonBackSale] winback status update matched 0 rows');
    }

    // Step 7: Log activities
    const userName = teamMembers.find(m => m.id === currentUserTeamMemberId)?.name || 'Unknown';

    await supabase.from('winback_activities').insert({
      household_id: householdId,
      agency_id: agencyId,
      activity_type: 'status_change',
      old_status: household.status,
      new_status: 'won_back',
      created_by_team_member_id: currentUserTeamMemberId || null,
      created_by_name: userName,
    });

    // Mirror to contact_activities (use resolved contact, not stale household.contact_id)
    if (resolvedContactId) {
      try {
        await supabase.rpc('insert_contact_activity', {
          p_agency_id: agencyId,
          p_contact_id: resolvedContactId,
          p_source_module: 'winback',
          p_activity_type: 'won_back',
          p_source_record_id: householdId,
          p_notes: `Won back: ${totalPolicies} policies, ${totalItems} items, $${totalPremium.toLocaleString()}`,
          p_created_by_display_name: userName,
        });
      } catch (mirrorErr) {
        console.warn('[recordWonBackSale] contact_activities mirror error:', mirrorErr);
      }
    }

    return { success: true, saleId };
  } catch (err) {
    console.error('[recordWonBackSale] unexpected error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
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
  original_year: number | null;
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
    .eq('agency_id', agencyId)
    .eq('status', 'active');

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
      original_year,
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
    .eq('source', 'csv_upload')
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
