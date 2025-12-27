import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CancelAuditRecord, ReportType } from '@/types/cancel-audit';

interface UseCancelAuditRecordsOptions {
  agencyId: string | null;
  reportTypeFilter: ReportType | 'all';
  searchQuery: string;
  sortBy: 'urgency' | 'name' | 'date_added';
}

export interface RecordWithActivityCount extends CancelAuditRecord {
  activity_count: number;
  last_activity_at: string | null;
  household_policy_count: number;
}

export function useCancelAuditRecords({
  agencyId,
  reportTypeFilter,
  searchQuery,
  sortBy
}: UseCancelAuditRecordsOptions) {
  return useQuery({
    queryKey: ['cancel-audit-records', agencyId, reportTypeFilter, searchQuery, sortBy],
    queryFn: async (): Promise<RecordWithActivityCount[]> => {
      if (!agencyId) return [];

      // Base query - fetch records with activity counts
      let query = supabase
        .from('cancel_audit_records')
        .select(`
          *,
          cancel_audit_activities(id, created_at)
        `)
        .eq('agency_id', agencyId)
        .eq('is_active', true);

      // Apply report type filter
      if (reportTypeFilter !== 'all') {
        query = query.eq('report_type', reportTypeFilter);
      }

      // Apply search filter (name or policy number)
      if (searchQuery.trim()) {
        const search = searchQuery.trim();
        query = query.or(`insured_first_name.ilike.%${search}%,insured_last_name.ilike.%${search}%,policy_number.ilike.%${search}%`);
      }

      // Apply sorting
      if (sortBy === 'urgency') {
        // Pending cancels first (by pending_cancel_date), then cancellations (by cancel_date)
        query = query
          .order('pending_cancel_date', { ascending: true, nullsFirst: false })
          .order('cancel_date', { ascending: true, nullsFirst: false });
      } else if (sortBy === 'name') {
        query = query
          .order('insured_last_name', { ascending: true })
          .order('insured_first_name', { ascending: true });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      const { data, error } = await query;

      if (error) throw error;

      // Calculate household policy counts
      const householdPolicyCounts = new Map<string, number>();
      (data || []).forEach(record => {
        const count = householdPolicyCounts.get(record.household_key) || 0;
        householdPolicyCounts.set(record.household_key, count + 1);
      });

      // Transform the data to include activity count, last activity, and household policy count
      return (data || []).map(record => {
        const activities = (record as any).cancel_audit_activities || [];
        const sortedActivities = [...activities].sort((a: any, b: any) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        
        // Remove the nested activities from the record to match CancelAuditRecord type
        const { cancel_audit_activities, ...cleanRecord } = record as any;
        
        return {
          ...cleanRecord,
          activity_count: activities.length,
          last_activity_at: sortedActivities[0]?.created_at || null,
          household_policy_count: householdPolicyCounts.get(record.household_key) || 1,
        } as RecordWithActivityCount;
      });
    },
    enabled: !!agencyId,
    staleTime: 30000, // 30 seconds
  });
}
