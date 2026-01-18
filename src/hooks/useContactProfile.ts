import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getStaffSessionToken } from '@/lib/cancel-audit-api';
import type {
  Contact,
  ContactActivity,
  ContactProfile,
  LinkedLQSRecord,
  LinkedRenewalRecord,
  LinkedCancelAuditRecord,
  LinkedWinbackRecord,
  LifecycleStage,
  JourneyEvent,
} from '@/types/contact';

interface UseContactProfileOptions {
  // Direct IDs from parent page - more reliable than trying to discover via contact_id
  cancelAuditHouseholdKey?: string;
  winbackHouseholdId?: string;
}

export function useContactProfile(
  contactId: string | null,
  agencyId: string | null,
  options?: UseContactProfileOptions
) {
  const staffSessionToken = getStaffSessionToken();
  const { cancelAuditHouseholdKey, winbackHouseholdId } = options || {};

  return useQuery({
    queryKey: ['contact-profile', contactId, agencyId, cancelAuditHouseholdKey, winbackHouseholdId, !!staffSessionToken],
    queryFn: async (): Promise<ContactProfile | null> => {
      if (!contactId || !agencyId) return null;

      // Fetch the contact
      const { data: contact, error: contactError } = await supabase
        .from('agency_contacts')
        .select('*')
        .eq('id', contactId)
        .eq('agency_id', agencyId)
        .single();

      if (contactError) {
        if (contactError.code === 'PGRST116') return null; // Not found
        throw contactError;
      }

      // First, get household_key from the contact to find related module activities
      const householdKey = contact.household_key;

      // Fetch linked records and unified activities in parallel
      const [activitiesResult, lqsResult, renewalResult, cancelAuditResult, winbackResult] = await Promise.all([
        // Unified activities from contact_activities
        supabase
          .from('contact_activities')
          .select('*')
          .eq('contact_id', contactId)
          .eq('agency_id', agencyId)
          .order('activity_date', { ascending: false })
          .limit(100),

        // LQS records
        supabase
          .from('lqs_households')
          .select(`
            id,
            status,
            created_at,
            team_member_id,
            team_members:team_member_id (id, name)
          `)
          .eq('contact_id', contactId)
          .eq('agency_id', agencyId)
          .order('created_at', { ascending: false }),

        // Renewal records
        supabase
          .from('renewal_records')
          .select(`
            id,
            policy_number,
            renewal_effective_date,
            renewal_status,
            current_status,
            premium_new,
            assigned_team_member:team_members!renewal_records_assigned_team_member_id_fkey (id, name)
          `)
          .eq('contact_id', contactId)
          .eq('agency_id', agencyId)
          .eq('is_active', true)
          .order('renewal_effective_date', { ascending: false }),

        // Cancel audit records
        supabase
          .from('cancel_audit_records')
          .select(`
            id,
            household_key,
            cancel_status,
            cancel_reason,
            created_at,
            assigned_team_member_id,
            team_members:assigned_team_member_id (id, name)
          `)
          .eq('contact_id', contactId)
          .eq('agency_id', agencyId)
          .order('created_at', { ascending: false }),

        // Winback records
        supabase
          .from('winback_households')
          .select(`
            id,
            status,
            termination_date,
            earliest_winback_date,
            assigned_team_member_id,
            team_members:assigned_team_member_id (id, name)
          `)
          .eq('contact_id', contactId)
          .eq('agency_id', agencyId)
          .order('created_at', { ascending: false }),
      ]);

      // Transform linked records
      const lqsRecords: LinkedLQSRecord[] = (lqsResult.data || []).map((r: any) => ({
        id: r.id,
        status: r.status,
        quoted_premium: null, // LQS might not have this field directly
        sold_date: r.status === 'sold' || r.status === 'Sold' ? r.created_at : null,
        team_member_name: r.team_members?.name || null,
        created_at: r.created_at,
      }));

      const renewalRecords: LinkedRenewalRecord[] = (renewalResult.data || []).map((r: any) => ({
        id: r.id,
        policy_number: r.policy_number,
        renewal_effective_date: r.renewal_effective_date,
        renewal_status: r.renewal_status,
        current_status: r.current_status,
        premium_new: r.premium_new,
        assigned_team_member_name: r.assigned_team_member?.name || null,
      }));

      const cancelAuditRecords: LinkedCancelAuditRecord[] = (cancelAuditResult.data || []).map((r: any) => ({
        id: r.id,
        cancel_status: r.cancel_status,
        cancel_reason: r.cancel_reason,
        resolution: null, // May need to add this field
        assigned_team_member_name: r.team_members?.name || null,
        created_at: r.created_at,
      }));

      const winbackRecords: LinkedWinbackRecord[] = (winbackResult.data || []).map((r: any) => ({
        id: r.id,
        status: r.status,
        termination_date: r.termination_date,
        earliest_winback_date: r.earliest_winback_date,
        assigned_team_member_name: r.team_members?.name || null,
      }));

      // Determine current stage
      const currentStage = determineLifecycleStage(lqsRecords, renewalRecords, cancelAuditRecords, winbackRecords);

      // Build list of IDs for activity lookup
      // Prefer direct IDs from props, fall back to discovered IDs from linked records
      const winbackHouseholdIds = winbackHouseholdId
        ? [winbackHouseholdId]
        : winbackRecords.map(r => r.id);

      // Get household_keys for cancel audit - prefer direct key from props
      const cancelAuditKeys = new Set<string>();
      if (cancelAuditHouseholdKey) {
        cancelAuditKeys.add(cancelAuditHouseholdKey);
      }
      if (householdKey) {
        cancelAuditKeys.add(householdKey);
      }
      // Also add keys from linked cancel audit records
      (cancelAuditResult.data || []).forEach((r: any) => {
        if (r.household_key) cancelAuditKeys.add(r.household_key);
      });
      const cancelAuditHouseholdKeys = Array.from(cancelAuditKeys);

      // Fetch module activities in parallel
      const [winbackActivitiesResult, cancelAuditActivitiesResult] = await Promise.all([
        // Winback activities
        winbackHouseholdIds.length > 0
          ? supabase
              .from('winback_activities')
              .select('id, activity_type, notes, created_by_name, created_at, household_id')
              .eq('agency_id', agencyId)
              .in('household_id', winbackHouseholdIds)
              .order('created_at', { ascending: false })
              .limit(50)
          : Promise.resolve({ data: [], error: null }),

        // Cancel audit activities
        cancelAuditHouseholdKeys.length > 0
          ? supabase
              .from('cancel_audit_activities')
              .select('id, activity_type, notes, created_by_name, created_at, household_key')
              .eq('agency_id', agencyId)
              .in('household_key', cancelAuditHouseholdKeys)
              .order('created_at', { ascending: false })
              .limit(50)
          : Promise.resolve({ data: [], error: null }),
      ]);

      // Merge activities from all sources
      const unifiedActivities: ContactActivity[] = (activitiesResult.data || []) as ContactActivity[];

      // Convert and add winback activities
      const winbackActivities: ContactActivity[] = (winbackActivitiesResult.data || []).map((wa: any) => ({
        id: wa.id,
        contact_id: contactId,
        agency_id: agencyId,
        source_module: 'winback' as const,
        activity_type: mapWinbackActivityType(wa.activity_type),
        notes: wa.notes,
        created_by_display_name: wa.created_by_name,
        activity_date: wa.created_at,
        created_at: wa.created_at,
      }));

      // Convert and add cancel audit activities
      const cancelAuditActivities: ContactActivity[] = (cancelAuditActivitiesResult.data || []).map((ca: any) => ({
        id: ca.id,
        contact_id: contactId,
        agency_id: agencyId,
        source_module: 'cancel_audit' as const,
        activity_type: mapCancelAuditActivityType(ca.activity_type),
        notes: ca.notes,
        created_by_display_name: ca.created_by_name,
        activity_date: ca.created_at,
        created_at: ca.created_at,
      }));

      // Merge and sort all activities by date (most recent first)
      const allActivities = [...unifiedActivities, ...winbackActivities, ...cancelAuditActivities]
        .sort((a, b) => new Date(b.activity_date || b.created_at).getTime() - new Date(a.activity_date || a.created_at).getTime());

      return {
        ...contact,
        current_stage: currentStage,
        activities: allActivities,
        lqs_records: lqsRecords,
        renewal_records: renewalRecords,
        cancel_audit_records: cancelAuditRecords,
        winback_records: winbackRecords,
      };
    },
    enabled: !!contactId && !!agencyId,
  });
}

// Get contact by various identifiers (useful for linking from queue pages)
export function useContactByIdentifier(
  agencyId: string | null,
  identifier: {
    contactId?: string;
    householdKey?: string;
    phone?: string;
    email?: string;
  } | null
) {
  return useQuery({
    queryKey: ['contact-by-identifier', agencyId, identifier],
    queryFn: async (): Promise<Contact | null> => {
      if (!agencyId || !identifier) return null;

      // Try by contact_id first (most direct)
      if (identifier.contactId) {
        const { data, error } = await supabase
          .from('agency_contacts')
          .select('*')
          .eq('id', identifier.contactId)
          .eq('agency_id', agencyId)
          .single();

        if (!error && data) return data;
      }

      // Try by household_key
      if (identifier.householdKey) {
        const { data, error } = await supabase
          .from('agency_contacts')
          .select('*')
          .eq('household_key', identifier.householdKey)
          .eq('agency_id', agencyId)
          .single();

        if (!error && data) return data;
      }

      // Try by phone
      if (identifier.phone) {
        const { data, error } = await supabase
          .from('agency_contacts')
          .select('*')
          .eq('agency_id', agencyId)
          .contains('phones', [identifier.phone])
          .limit(1)
          .single();

        if (!error && data) return data;
      }

      // Try by email
      if (identifier.email) {
        const { data, error } = await supabase
          .from('agency_contacts')
          .select('*')
          .eq('agency_id', agencyId)
          .contains('emails', [identifier.email])
          .limit(1)
          .single();

        if (!error && data) return data;
      }

      return null;
    },
    enabled: !!agencyId && !!identifier && (
      !!identifier.contactId ||
      !!identifier.householdKey ||
      !!identifier.phone ||
      !!identifier.email
    ),
  });
}

// Build journey events from linked records for visualization
export function useContactJourney(contactId: string | null, agencyId: string | null) {
  return useQuery({
    queryKey: ['contact-journey', contactId, agencyId],
    queryFn: async (): Promise<JourneyEvent[]> => {
      if (!contactId || !agencyId) return [];

      // Fetch key milestone data
      const [lqsResult, renewalResult, cancelAuditResult, winbackResult] = await Promise.all([
        supabase
          .from('lqs_households')
          .select('id, status, created_at')
          .eq('contact_id', contactId)
          .eq('agency_id', agencyId)
          .order('created_at', { ascending: true }),

        supabase
          .from('renewal_records')
          .select('id, current_status, renewal_effective_date, created_at')
          .eq('contact_id', contactId)
          .eq('agency_id', agencyId)
          .order('renewal_effective_date', { ascending: true }),

        supabase
          .from('cancel_audit_records')
          .select('id, cancel_status, created_at')
          .eq('contact_id', contactId)
          .eq('agency_id', agencyId)
          .order('created_at', { ascending: true }),

        supabase
          .from('winback_households')
          .select('id, status, termination_date, created_at')
          .eq('contact_id', contactId)
          .eq('agency_id', agencyId)
          .order('created_at', { ascending: true }),
      ]);

      const events: JourneyEvent[] = [];

      // LQS events
      (lqsResult.data || []).forEach((r: any) => {
        const status = (r.status || '').toLowerCase();
        if (status === 'lead') {
          events.push({
            stage: 'open_lead',
            date: r.created_at,
            label: 'Lead Created',
            source_module: 'lqs',
            source_record_id: r.id,
          });
        } else if (status === 'quoted') {
          events.push({
            stage: 'quoted',
            date: r.created_at,
            label: 'Quote Provided',
            source_module: 'lqs',
            source_record_id: r.id,
          });
        } else if (status === 'sold') {
          events.push({
            stage: 'customer',
            date: r.created_at,
            label: 'Policy Sold',
            source_module: 'lqs',
            source_record_id: r.id,
          });
        }
      });

      // Renewal events
      (renewalResult.data || []).forEach((r: any) => {
        events.push({
          stage: 'renewal',
          date: r.created_at,
          label: 'Renewal Pending',
          source_module: 'renewal',
          source_record_id: r.id,
        });

        if (r.current_status === 'success') {
          events.push({
            stage: 'customer',
            date: r.renewal_effective_date,
            label: 'Renewal Completed',
            source_module: 'renewal',
            source_record_id: r.id,
          });
        }
      });

      // Cancel audit events
      (cancelAuditResult.data || []).forEach((r: any) => {
        events.push({
          stage: 'cancel_audit',
          date: r.created_at,
          label: 'Cancel Request',
          source_module: 'cancel_audit',
          source_record_id: r.id,
        });

        if (r.cancel_status === 'Saved' || r.cancel_status === 'saved') {
          events.push({
            stage: 'customer',
            date: r.created_at,
            label: 'Account Saved',
            source_module: 'cancel_audit',
            source_record_id: r.id,
          });
        }
      });

      // Winback events
      (winbackResult.data || []).forEach((r: any) => {
        events.push({
          stage: 'winback',
          date: r.created_at,
          label: 'Win-back Started',
          source_module: 'winback',
          source_record_id: r.id,
        });

        if (r.status === 'won_back') {
          events.push({
            stage: 'customer',
            date: r.created_at,
            label: 'Customer Won Back',
            source_module: 'winback',
            source_record_id: r.id,
          });
        }
      });

      // Sort by date
      events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      return events;
    },
    enabled: !!contactId && !!agencyId,
  });
}

// Map winback activity types to unified activity types
function mapWinbackActivityType(type: string): string {
  const mapping: Record<string, string> = {
    'called': 'call',
    'left_vm': 'voicemail',
    'texted': 'text',
    'emailed': 'email',
    'note': 'note',
    'status_change': 'status_change',
  };
  return mapping[type] || type;
}

// Map cancel audit activity types to unified activity types
function mapCancelAuditActivityType(type: string): string {
  const mapping: Record<string, string> = {
    'attempted_call': 'call',
    'voicemail_left': 'voicemail',
    'text_sent': 'text',
    'email_sent': 'email',
    'spoke_with_client': 'spoke',
    'payment_made': 'payment',
    'payment_promised': 'payment_promised',
    'note': 'note',
  };
  return mapping[type] || type;
}

// Helper function to determine lifecycle stage
function determineLifecycleStage(
  lqsRecords: LinkedLQSRecord[],
  renewalRecords: LinkedRenewalRecord[],
  cancelAuditRecords: LinkedCancelAuditRecord[],
  winbackRecords: LinkedWinbackRecord[]
): LifecycleStage {
  // Check for active winback - priority 1
  const activeWinback = winbackRecords.find(r =>
    r.status === 'in_progress' || r.status === 'untouched'
  );
  if (activeWinback) return 'winback';

  // Check for cancel audit - priority 2 (any contact in cancel audit)
  if (cancelAuditRecords.length > 0) return 'cancel_audit';

  // Check for pending renewal - priority 3
  const pendingRenewal = renewalRecords.find(r =>
    r.current_status === 'uncontacted' || r.current_status === 'pending'
  );
  if (pendingRenewal) return 'renewal';

  // Check for customer (sold LQS, successful renewal, or won_back) - priority 4
  const wonBack = winbackRecords.find(r => r.status === 'won_back');
  const successfulRenewal = renewalRecords.find(r => r.current_status === 'success');
  const soldLqs = lqsRecords.find(r => (r.status || '').toLowerCase() === 'sold');
  if (successfulRenewal || soldLqs || wonBack) return 'customer';

  // Check for quoted - priority 5
  const quotedLqs = lqsRecords.find(r => (r.status || '').toLowerCase() === 'quoted');
  if (quotedLqs) return 'quoted';

  // Check for open lead - priority 6
  const leadLqs = lqsRecords.find(r => (r.status || '').toLowerCase() === 'lead');
  if (leadLqs) return 'open_lead';

  // Default to open_lead
  return 'open_lead';
}
