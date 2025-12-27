import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface WeeklyStats {
  weekStart: string;
  weekEnd: string;
  totalRecords: number;
  activeRecords: number;
  needsAttentionCount: number;
  pendingCancelCount: number;
  cancellationCount: number;
  totalContacts: number;
  uniqueHouseholdsContacted: number;
  paymentsMade: number;
  paymentsPromised: number;
  premiumRecovered: number;
  coveragePercent: number;
  byTeamMember: {
    name: string;
    contacts: number;
    paymentsMade: number;
  }[];
}

interface UseCancelAuditStatsOptions {
  agencyId: string | null;
  weekOffset: number;
}

const CONTACT_ACTIVITY_TYPES = [
  'attempted_call',
  'voicemail_left',
  'text_sent',
  'email_sent',
  'spoke_with_client',
];

export function useCancelAuditStats({ agencyId, weekOffset }: UseCancelAuditStatsOptions) {
  return useQuery({
    queryKey: ['cancel-audit-stats', agencyId, weekOffset],
    queryFn: async (): Promise<WeeklyStats> => {
      if (!agencyId) throw new Error('No agency ID');

      // Calculate week boundaries (Monday to Sunday)
      const today = new Date();
      const currentDay = today.getDay();
      const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
      
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() + mondayOffset + (weekOffset * 7));
      weekStart.setHours(0, 0, 0, 0);
      
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      const weekStartISO = weekStart.toISOString();
      const weekEndISO = weekEnd.toISOString();

      // Fetch all records for the agency (both active and inactive for total count)
      const { data: records, error: recordsError } = await supabase
        .from('cancel_audit_records')
        .select('id, household_key, report_type, premium_cents, status, is_active')
        .eq('agency_id', agencyId);

      if (recordsError) throw recordsError;

      // Filter for active records only for actionable stats
      const activeRecords = records?.filter(r => r.is_active) || [];
      const needsAttentionRecords = activeRecords.filter(r => 
        ['new', 'in_progress'].includes(r.status)
      );

      // Fetch activities for this week
      const { data: activities, error: activitiesError } = await supabase
        .from('cancel_audit_activities')
        .select('id, activity_type, household_key, record_id, user_display_name, created_at')
        .eq('agency_id', agencyId)
        .gte('created_at', weekStartISO)
        .lte('created_at', weekEndISO);

      if (activitiesError) throw activitiesError;

      // Calculate stats
      const totalRecords = records?.length || 0;
      const activeCount = activeRecords.length;
      const needsAttentionCount = needsAttentionRecords.length;
      const pendingCancelCount = needsAttentionRecords.filter(r => r.report_type === 'pending_cancel').length;
      const cancellationCount = needsAttentionRecords.filter(r => r.report_type === 'cancellation').length;

      // Contact activities
      const contactActivities = activities?.filter(a => 
        CONTACT_ACTIVITY_TYPES.includes(a.activity_type)
      ) || [];
      
      const totalContacts = contactActivities.length;
      const uniqueHouseholdsContacted = new Set(contactActivities.map(a => a.household_key)).size;
      const totalUniqueHouseholds = new Set(records?.map(r => r.household_key) || []).size;

      // Wins
      const paymentsMade = activities?.filter(a => a.activity_type === 'payment_made').length || 0;
      const paymentsPromised = activities?.filter(a => a.activity_type === 'payment_promised').length || 0;

      // Premium recovered
      const recordsWithPayment = new Set(
        activities?.filter(a => a.activity_type === 'payment_made').map(a => a.record_id) || []
      );
      const premiumRecovered = records
        ?.filter(r => recordsWithPayment.has(r.id))
        .reduce((sum, r) => sum + (r.premium_cents || 0), 0) || 0;

      // Coverage percent
      const coveragePercent = totalUniqueHouseholds > 0 
        ? Math.round((uniqueHouseholdsContacted / totalUniqueHouseholds) * 100)
        : 0;

      // By team member
      const teamMemberMap = new Map<string, { contacts: number; paymentsMade: number }>();
      activities?.forEach(activity => {
        const name = activity.user_display_name;
        if (!teamMemberMap.has(name)) {
          teamMemberMap.set(name, { contacts: 0, paymentsMade: 0 });
        }
        const stats = teamMemberMap.get(name)!;
        if (CONTACT_ACTIVITY_TYPES.includes(activity.activity_type)) {
          stats.contacts++;
        }
        if (activity.activity_type === 'payment_made') {
          stats.paymentsMade++;
        }
      });

      const byTeamMember = Array.from(teamMemberMap.entries())
        .map(([name, stats]) => ({ name, ...stats }))
        .sort((a, b) => b.contacts - a.contacts);

      return {
        weekStart: weekStart.toISOString().split('T')[0],
        weekEnd: weekEnd.toISOString().split('T')[0],
        totalRecords,
        activeRecords: activeCount,
        needsAttentionCount,
        pendingCancelCount,
        cancellationCount,
        totalContacts,
        uniqueHouseholdsContacted,
        paymentsMade,
        paymentsPromised,
        premiumRecovered,
        coveragePercent,
        byTeamMember,
      };
    },
    enabled: !!agencyId,
    staleTime: 60000,
  });
}