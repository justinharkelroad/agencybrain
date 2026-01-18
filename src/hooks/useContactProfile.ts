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

export function useContactProfile(contactId: string | null, agencyId: string | null) {
  const staffSessionToken = getStaffSessionToken();

  return useQuery({
    queryKey: ['contact-profile', contactId, agencyId, !!staffSessionToken],
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

      // Fetch all linked records and activities in parallel
      const [activitiesResult, lqsResult, renewalResult, cancelAuditResult, winbackResult] = await Promise.all([
        // Activities
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

      return {
        ...contact,
        current_stage: currentStage,
        activities: (activitiesResult.data || []) as ContactActivity[],
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
