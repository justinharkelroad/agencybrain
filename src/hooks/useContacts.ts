import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getStaffSessionToken } from '@/lib/cancel-audit-api';
import type { Contact, ContactWithStatus, ContactFilters, LifecycleStage } from '@/types/contact';

const PAGE_SIZE = 100;

export function useContacts(agencyId: string | null, filters: ContactFilters = {}) {
  const staffSessionToken = getStaffSessionToken();

  return useInfiniteQuery({
    queryKey: ['contacts', agencyId, filters, !!staffSessionToken],
    queryFn: async ({ pageParam = 0 }): Promise<{ contacts: ContactWithStatus[]; nextCursor: number | null; total: number }> => {
      if (!agencyId) return { contacts: [], nextCursor: null, total: 0 };

      // First get total count
      const { count } = await supabase
        .from('agency_contacts')
        .select('*', { count: 'exact', head: true })
        .eq('agency_id', agencyId);

      // Build query with pagination
      let query = supabase
        .from('agency_contacts')
        .select('*')
        .eq('agency_id', agencyId)
        .order(filters.sortBy === 'last_activity' ? 'updated_at' : filters.sortBy === 'created_at' ? 'created_at' : 'last_name', {
          ascending: filters.sortDirection !== 'desc'
        })
        .order('first_name', { ascending: true })
        .range(pageParam, pageParam + PAGE_SIZE - 1);

      // Apply search filter
      if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        query = query.or(
          `first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,phones.cs.{${searchTerm}},emails.cs.{${searchTerm}}`
        );
      }

      const { data: contacts, error } = await query;
      if (error) throw error;

      // Compute current stage for each contact by checking linked records
      const contactsWithStatus = await computeContactStatuses(contacts || [], agencyId);

      // Filter by stage if specified (client-side for now)
      // Note: This is not ideal for large datasets - consider pre-computing stages in DB
      let filteredContacts = contactsWithStatus;
      if (filters.stage?.length) {
        filteredContacts = contactsWithStatus.filter(c => filters.stage!.includes(c.current_stage));
      }

      const hasMore = (pageParam + PAGE_SIZE) < (count || 0);
      return {
        contacts: filteredContacts,
        nextCursor: hasMore ? pageParam + PAGE_SIZE : null,
        total: count || 0,
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

  // Fetch linked records in parallel
  const [lqsResult, renewalResult, cancelAuditResult, winbackResult, activityResult] = await Promise.all([
    supabase
      .from('lqs_households')
      .select('contact_id, status, created_at')
      .eq('agency_id', agencyId)
      .in('contact_id', contactIds),
    supabase
      .from('renewal_records')
      .select('contact_id, current_status, renewal_effective_date')
      .eq('agency_id', agencyId)
      .eq('is_active', true)
      .in('contact_id', contactIds),
    supabase
      .from('cancel_audit_records')
      .select('contact_id, cancel_status')
      .eq('agency_id', agencyId)
      .in('contact_id', contactIds),
    supabase
      .from('winback_households')
      .select('contact_id, status')
      .eq('agency_id', agencyId)
      .in('contact_id', contactIds),
    supabase
      .from('contact_activities')
      .select('contact_id, activity_type, activity_date')
      .eq('agency_id', agencyId)
      .in('contact_id', contactIds)
      .order('activity_date', { ascending: false })
      .limit(1),
  ]);

  // Build lookup maps
  const lqsMap = new Map<string, any[]>();
  const renewalMap = new Map<string, any[]>();
  const cancelAuditMap = new Map<string, any[]>();
  const winbackMap = new Map<string, any[]>();
  const lastActivityMap = new Map<string, { type: string; date: string }>();

  (lqsResult.data || []).forEach(r => {
    if (!lqsMap.has(r.contact_id)) lqsMap.set(r.contact_id, []);
    lqsMap.get(r.contact_id)!.push(r);
  });

  (renewalResult.data || []).forEach(r => {
    if (!renewalMap.has(r.contact_id)) renewalMap.set(r.contact_id, []);
    renewalMap.get(r.contact_id)!.push(r);
  });

  (cancelAuditResult.data || []).forEach(r => {
    if (!cancelAuditMap.has(r.contact_id)) cancelAuditMap.set(r.contact_id, []);
    cancelAuditMap.get(r.contact_id)!.push(r);
  });

  (winbackResult.data || []).forEach(r => {
    if (!winbackMap.has(r.contact_id)) winbackMap.set(r.contact_id, []);
    winbackMap.get(r.contact_id)!.push(r);
  });

  (activityResult.data || []).forEach(r => {
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
  // Check for active winback
  const activeWinback = winbackRecords.find(r => r.status === 'in_progress' || r.status === 'untouched' || r.status === 'teed_up_this_week');
  if (activeWinback) return 'winback';

  // Check for won back
  const wonBack = winbackRecords.find(r => r.status === 'won_back');
  if (wonBack) return 'won_back';

  // Check for cancel audit (at risk)
  const atRisk = cancelAuditRecords.find(r =>
    r.cancel_status === 'Uncontacted' ||
    r.cancel_status === 'In Progress' ||
    r.cancel_status === 'uncontacted' ||
    r.cancel_status === 'in_progress'
  );
  if (atRisk) return 'at_risk';

  // Check for cancelled
  const cancelled = cancelAuditRecords.find(r => r.cancel_status === 'Lost' || r.cancel_status === 'lost');
  if (cancelled && !renewalRecords.length && !wonBack) return 'cancelled';

  // Check for pending renewal
  const pendingRenewal = renewalRecords.find(r =>
    r.current_status === 'uncontacted' ||
    r.current_status === 'pending'
  );
  if (pendingRenewal) return 'renewal';

  // Check for successful renewal or sold LQS (active customer)
  const successfulRenewal = renewalRecords.find(r => r.current_status === 'success');
  const soldLqs = lqsRecords.find(r => r.status === 'sold' || r.status === 'Sold');
  if (successfulRenewal || soldLqs) return 'customer';

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
