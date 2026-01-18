import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getStaffSessionToken } from '@/lib/cancel-audit-api';
import type { Contact, ContactWithStatus, ContactFilters, LifecycleStage } from '@/types/contact';

const PAGE_SIZE = 100;

export function useContacts(agencyId: string | null, filters: ContactFilters = {}) {
  const staffSessionToken = getStaffSessionToken();
  const hasStageFilter = filters.stage && filters.stage.length > 0;

  return useInfiniteQuery({
    queryKey: ['contacts', agencyId, filters, !!staffSessionToken],
    queryFn: async ({ pageParam = 0 }): Promise<{ contacts: ContactWithStatus[]; nextCursor: number | null; total: number }> => {
      if (!agencyId) return { contacts: [], nextCursor: null, total: 0 };

      // When stage filter is applied, we need to fetch all contacts and filter client-side
      // because the stage is computed from linked records
      // Fetch all contacts (up to 15000) when filtering by stage
      const fetchLimit = hasStageFilter ? 15000 : PAGE_SIZE;
      const startOffset = hasStageFilter ? 0 : pageParam;

      // Build query - pagination only when no stage filter
      let query = supabase
        .from('agency_contacts')
        .select('*', { count: 'exact' })
        .eq('agency_id', agencyId)
        .order(filters.sortBy === 'last_activity' ? 'updated_at' : filters.sortBy === 'created_at' ? 'created_at' : 'last_name', {
          ascending: filters.sortDirection !== 'desc'
        })
        .order('first_name', { ascending: true })
        .range(startOffset, startOffset + fetchLimit - 1);

      // Apply search filter
      if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        query = query.or(
          `first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,phones.cs.{${searchTerm}},emails.cs.{${searchTerm}}`
        );
      }

      const { data: contacts, error, count } = await query;
      if (error) throw error;

      // Compute current stage for each contact by checking linked records
      const contactsWithStatus = await computeContactStatuses(contacts || [], agencyId);

      // Filter by stage if specified (client-side)
      let filteredContacts = contactsWithStatus;
      if (hasStageFilter) {
        filteredContacts = contactsWithStatus.filter(c => filters.stage!.includes(c.current_stage));
      }

      // When stage filter is applied, apply client-side pagination
      let paginatedContacts = filteredContacts;
      let hasMore = false;

      if (hasStageFilter) {
        const startIdx = pageParam;
        const endIdx = startIdx + PAGE_SIZE;
        paginatedContacts = filteredContacts.slice(startIdx, endIdx);
        hasMore = endIdx < filteredContacts.length;
      } else {
        hasMore = (pageParam + PAGE_SIZE) < (count || 0);
      }

      return {
        contacts: paginatedContacts,
        nextCursor: hasMore ? pageParam + PAGE_SIZE : null,
        total: hasStageFilter ? filteredContacts.length : (count || 0),
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: 0,
    enabled: !!agencyId,
  });
}

// Compute the current lifecycle stage for contacts based on their linked records
async function computeContactStatuses(contacts: Contact[], agencyId: string): Promise<ContactWithStatus[]> {
  if (contacts.length === 0) return [];

  const contactIds = contacts.map(c => c.id);

  // Batch the queries to avoid 400 Bad Request with too many IDs
  // PostgREST has limits on query URL length
  // Using smaller batch to avoid hitting row limits (contacts may have multiple records)
  const BATCH_SIZE = 100;
  const batches: string[][] = [];
  for (let i = 0; i < contactIds.length; i += BATCH_SIZE) {
    batches.push(contactIds.slice(i, i + BATCH_SIZE));
  }

  // Fetch linked records in batches
  const lqsResults: any[] = [];
  const renewalResults: any[] = [];
  const cancelAuditResults: any[] = [];
  const winbackResults: any[] = [];
  const activityResults: any[] = [];

  for (const batch of batches) {
    // Note: Adding explicit limits to avoid Supabase default 1000 row limit
    // Some contacts may have multiple records in each table
    const [lqsResult, renewalResult, cancelAuditResult, winbackResult, activityResult] = await Promise.all([
      supabase
        .from('lqs_households')
        .select('contact_id, status, created_at')
        .eq('agency_id', agencyId)
        .in('contact_id', batch)
        .limit(5000),
      supabase
        .from('renewal_records')
        .select('contact_id, current_status, renewal_effective_date')
        .eq('agency_id', agencyId)
        .eq('is_active', true)
        .in('contact_id', batch)
        .limit(5000),
      supabase
        .from('cancel_audit_records')
        .select('contact_id, cancel_status')
        .eq('agency_id', agencyId)
        .in('contact_id', batch)
        .limit(5000),
      supabase
        .from('winback_households')
        .select('contact_id, status')
        .eq('agency_id', agencyId)
        .in('contact_id', batch)
        .limit(5000),
      supabase
        .from('contact_activities')
        .select('contact_id, activity_type, activity_date')
        .eq('agency_id', agencyId)
        .in('contact_id', batch)
        .order('activity_date', { ascending: false })
        .limit(5000),
    ]);

    if (lqsResult.data) lqsResults.push(...lqsResult.data);
    if (renewalResult.data) renewalResults.push(...renewalResult.data);
    if (cancelAuditResult.data) cancelAuditResults.push(...cancelAuditResult.data);
    if (winbackResult.data) winbackResults.push(...winbackResult.data);
    if (activityResult.data) activityResults.push(...activityResult.data);
  }

  // Build lookup maps
  const lqsMap = new Map<string, any[]>();
  const renewalMap = new Map<string, any[]>();
  const cancelAuditMap = new Map<string, any[]>();
  const winbackMap = new Map<string, any[]>();
  const lastActivityMap = new Map<string, { type: string; date: string }>();

  lqsResults.forEach(r => {
    if (!r.contact_id) return;
    if (!lqsMap.has(r.contact_id)) lqsMap.set(r.contact_id, []);
    lqsMap.get(r.contact_id)!.push(r);
  });

  renewalResults.forEach(r => {
    if (!r.contact_id) return;
    if (!renewalMap.has(r.contact_id)) renewalMap.set(r.contact_id, []);
    renewalMap.get(r.contact_id)!.push(r);
  });

  cancelAuditResults.forEach(r => {
    if (!r.contact_id) return;
    if (!cancelAuditMap.has(r.contact_id)) cancelAuditMap.set(r.contact_id, []);
    cancelAuditMap.get(r.contact_id)!.push(r);
  });

  winbackResults.forEach(r => {
    if (!r.contact_id) return;
    if (!winbackMap.has(r.contact_id)) winbackMap.set(r.contact_id, []);
    winbackMap.get(r.contact_id)!.push(r);
  });

  activityResults.forEach(r => {
    if (!r.contact_id) return;
    if (!lastActivityMap.has(r.contact_id)) {
      lastActivityMap.set(r.contact_id, { type: r.activity_type, date: r.activity_date });
    }
  });

  // Compute status for each contact
  return contacts.map(contact => {
    const lqsRecords = lqsMap.get(contact.id) || [];
    const renewalRecords = renewalMap.get(contact.id) || [];
    const cancelAuditRecords = cancelAuditMap.get(contact.id) || [];
    const winbackRecords = winbackMap.get(contact.id) || [];
    const lastActivity = lastActivityMap.get(contact.id);

    const stage = determineLifecycleStage(
      lqsRecords,
      renewalRecords,
      cancelAuditRecords,
      winbackRecords
    );

    return {
      ...contact,
      current_stage: stage,
      last_activity_at: lastActivity?.date || null,
      last_activity_type: lastActivity?.type as any || null,
    };
  });
}

// Determine the current lifecycle stage based on linked records
function determineLifecycleStage(
  lqsRecords: any[],
  renewalRecords: any[],
  cancelAuditRecords: any[],
  winbackRecords: any[]
): LifecycleStage {
  // Check for active winback - priority 1
  // Valid winback statuses: 'untouched', 'in_progress', 'won_back', 'declined', 'no_contact', 'dismissed'
  const activeWinback = winbackRecords.find(r =>
    r.status === 'in_progress' || r.status === 'untouched'
  );
  if (activeWinback) return 'winback';

  // Check for won back - priority 2
  const wonBack = winbackRecords.find(r => r.status === 'won_back');
  if (wonBack) return 'won_back';

  // Check for cancel audit - "at risk" means savable cancellation
  // cancel_status values: 'Cancel' (pending/savable), 'Cancelled' (already lost), 'Saved', 'Lost'
  const atRisk = cancelAuditRecords.find(r => {
    const status = (r.cancel_status || '').toLowerCase();
    return status === 'cancel'; // "Cancel" means still savable = at risk
  });
  if (atRisk) return 'at_risk';

  // Check for saved from cancel audit (became customer again)
  const savedFromCancel = cancelAuditRecords.find(r => {
    const status = (r.cancel_status || '').toLowerCase();
    return status === 'saved';
  });

  // Check for cancelled/lost
  const cancelled = cancelAuditRecords.find(r => {
    const status = (r.cancel_status || '').toLowerCase();
    return status === 'cancelled' || status === 'lost';
  });
  if (cancelled && !savedFromCancel && !wonBack && !renewalRecords.length) return 'cancelled';

  // Check for pending renewal
  const pendingRenewal = renewalRecords.find(r =>
    r.current_status === 'uncontacted' ||
    r.current_status === 'pending'
  );
  if (pendingRenewal) return 'renewal';

  // Check for successful renewal or sold LQS or saved from cancel (active customer)
  const successfulRenewal = renewalRecords.find(r => r.current_status === 'success');
  const soldLqs = lqsRecords.find(r => r.status === 'sold' || r.status === 'Sold');
  if (successfulRenewal || soldLqs || savedFromCancel) return 'customer';

  // Default to lead if only LQS records exist
  if (lqsRecords.length > 0) return 'lead';

  // Fallback
  return 'lead';
}

// Search contacts by phone, name, or email
export function useContactSearch(agencyId: string | null, searchTerm: string) {
  return useQuery({
    queryKey: ['contact-search', agencyId, searchTerm],
    queryFn: async (): Promise<Contact[]> => {
      if (!agencyId || !searchTerm || searchTerm.length < 2) return [];

      const normalizedSearch = searchTerm.toLowerCase().replace(/[^a-z0-9]/g, '');

      const { data, error } = await supabase
        .from('agency_contacts')
        .select('*')
        .eq('agency_id', agencyId)
        .or(
          `first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%`
        )
        .limit(10);

      if (error) throw error;

      // Also search by phone (normalized)
      const { data: phoneMatches, error: phoneError } = await supabase
        .from('agency_contacts')
        .select('*')
        .eq('agency_id', agencyId)
        .contains('phones', [searchTerm])
        .limit(10);

      if (!phoneError && phoneMatches) {
        // Merge results, removing duplicates
        const existingIds = new Set((data || []).map(c => c.id));
        const uniquePhoneMatches = phoneMatches.filter(c => !existingIds.has(c.id));
        return [...(data || []), ...uniquePhoneMatches].slice(0, 10);
      }

      return data || [];
    },
    enabled: !!agencyId && searchTerm.length >= 2,
  });
}
