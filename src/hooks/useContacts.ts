import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
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

      // Use server-side function for stage filtering - scales to any number of contacts
      const stageParam = filters.stage?.length === 1 ? filters.stage[0] : null;

      const { data, error } = await supabase.rpc('get_contacts_by_stage', {
        p_agency_id: agencyId,
        p_stage: stageParam,
        p_search: filters.search || null,
        p_limit: PAGE_SIZE,
        p_offset: pageParam,
      });

      if (error) {
        console.error('Error fetching contacts:', error);
        throw error;
      }

      const contacts = data || [];
      // Safely extract total_count, fallback to contacts.length if NaN
      const rawTotal = contacts.length > 0 ? Number(contacts[0].total_count) : 0;
      const total = Number.isFinite(rawTotal) ? rawTotal : contacts.length;

      // Map to ContactWithStatus format - use current_stage (not computed_stage)
      const contactsWithStatus: ContactWithStatus[] = contacts.map((c: any) => ({
        id: c.id,
        agency_id: c.agency_id,
        first_name: c.first_name,
        last_name: c.last_name,
        phones: c.phones || [],
        emails: c.emails || [],
        household_key: c.household_key,
        zip_code: c.zip_code,
        created_at: c.created_at,
        updated_at: c.updated_at,
        current_stage: (c.current_stage || 'open_lead') as LifecycleStage,
        last_activity_at: c.last_activity_at || null,
        last_activity_type: c.last_activity_type || null,
        assigned_team_member_name: c.assigned_team_member_name || null,
      }));

      const hasMore = (pageParam + PAGE_SIZE) < total;
      return {
        contacts: contactsWithStatus,
        nextCursor: hasMore ? pageParam + PAGE_SIZE : null,
        total,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: 0,
    enabled: !!agencyId,
  });
}

// Search contacts by phone, name, or email
export function useContactSearch(agencyId: string | null, searchTerm: string) {
  return useQuery({
    queryKey: ['contact-search', agencyId, searchTerm],
    queryFn: async (): Promise<Contact[]> => {
      if (!agencyId || !searchTerm || searchTerm.length < 2) return [];

      // Use the same server-side function with search parameter
      const { data, error } = await supabase.rpc('get_contacts_by_stage', {
        p_agency_id: agencyId,
        p_stage: null,
        p_search: searchTerm,
        p_limit: 20,
        p_offset: 0,
      });

      if (error) throw error;

      return (data || []).map((c: any) => ({
        id: c.id,
        agency_id: c.agency_id,
        first_name: c.first_name,
        last_name: c.last_name,
        phones: c.phones || [],
        emails: c.emails || [],
        household_key: c.household_key,
        zip_code: c.zip_code,
        created_at: c.created_at,
        updated_at: c.updated_at,
      }));
    },
    enabled: !!agencyId && searchTerm.length >= 2,
  });
}

// Find or create a contact for a source record
export async function findOrCreateContact(
  agencyId: string,
  data: {
    firstName: string;
    lastName: string;
    phone?: string;
    email?: string;
    zipCode?: string;
    householdKey: string;
  }
): Promise<string> {
  // First try to find existing contact by household key
  const { data: existing } = await supabase
    .from('agency_contacts')
    .select('id')
    .eq('agency_id', agencyId)
    .eq('household_key', data.householdKey)
    .single();

  if (existing) return existing.id;

  // Create new contact
  const phones = data.phone ? [data.phone] : [];
  const emails = data.email ? [data.email.toLowerCase()] : [];

  const { data: created, error } = await supabase
    .from('agency_contacts')
    .insert({
      agency_id: agencyId,
      first_name: data.firstName.toUpperCase(),
      last_name: data.lastName.toUpperCase(),
      phones,
      emails,
      zip_code: data.zipCode,
      household_key: data.householdKey,
    })
    .select('id')
    .single();

  if (error) throw error;
  return created.id;
}
