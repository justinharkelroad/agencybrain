import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CancelAuditRecord, ReportType } from '@/types/cancel-audit';
import { callCancelAuditApi, getStaffSessionToken } from '@/lib/cancel-audit-api';

export type ViewMode = 'needs_attention' | 'all';
export type CancelStatusFilter = 'all' | 'cancel' | 'cancelled' | 's-cancel' | 'saved' | 'unmatched';

interface UseCancelAuditRecordsOptions {
  agencyId: string | null;
  viewMode: ViewMode;
  reportTypeFilter: ReportType | 'all';
  searchQuery: string;
  sortBy: 'urgency' | 'name' | 'date_added' | 'cancel_status' | 'original_year' | 'policy_number' | 'premium';
  showCurrentOnly?: boolean;
  cancelStatusFilter?: CancelStatusFilter;
}

export interface RecordWithActivityCount extends CancelAuditRecord {
  activity_count: number;
  last_activity_at: string | null;
  household_policy_count: number;
  is_active: boolean;
  dropped_from_report_at: string | null;
}

export function useCancelAuditRecords({
  agencyId,
  viewMode,
  reportTypeFilter,
  searchQuery,
  sortBy,
  showCurrentOnly = true,
  cancelStatusFilter = 'all'
}: UseCancelAuditRecordsOptions) {
  const staffSessionToken = getStaffSessionToken();

  return useQuery({
    queryKey: ['cancel-audit-records', agencyId, viewMode, reportTypeFilter, searchQuery, sortBy, showCurrentOnly, cancelStatusFilter],
    queryFn: async (): Promise<RecordWithActivityCount[]> => {
      if (!agencyId) return [];

      // Staff portal: use edge function
      if (staffSessionToken) {
        const data = await callCancelAuditApi({
          operation: "get_records",
          params: {
            viewMode,
            reportTypeFilter,
            searchQuery,
            sortBy,
            cancelStatusFilter,
            showCurrentOnly,
          },
          sessionToken: staffSessionToken,
        });
        return data as RecordWithActivityCount[];
      }

      // Regular auth: use direct Supabase query
      let query = supabase
        .from('cancel_audit_records')
        .select(`
          *,
          cancel_audit_activities(id, created_at)
        `)
        .eq('agency_id', agencyId);

      // View mode filtering
      if (viewMode === 'needs_attention') {
        query = query.in('status', ['new', 'in_progress']);
        // showCurrentOnly is additive — additionally filter to latest upload only
        if (showCurrentOnly) {
          query = query.eq('is_active', true);
        }
      } else {
        // "All Records" view: filter to current records only when toggled
        if (showCurrentOnly) {
          query = query.eq('is_active', true);
        }
      }

      // Apply report type filter
      if (reportTypeFilter !== 'all') {
        query = query.eq('report_type', reportTypeFilter);
      }

      // Apply search filter (name or policy number)
      if (searchQuery.trim()) {
        const search = searchQuery.trim();
        query = query.or(`insured_first_name.ilike.%${search}%,insured_last_name.ilike.%${search}%,policy_number.ilike.%${search}%`);
      }

      // Apply cancel status filter (including fallback from report_type when cancel_status is missing)
      if (cancelStatusFilter !== 'all') {
        query = applyCancelStatusFilter(query, cancelStatusFilter);
      }

      // Apply sorting
      if (sortBy === 'urgency') {
        query = query
          .order('pending_cancel_date', { ascending: true, nullsFirst: false })
          .order('cancel_date', { ascending: true, nullsFirst: false });
      } else if (sortBy === 'name') {
        query = query
          .order('insured_last_name', { ascending: true })
          .order('insured_first_name', { ascending: true });
      } else if (sortBy === 'cancel_status') {
        // Sort by cancel_status: 'Cancel' (savable) first, then 'Cancelled'
        query = query
          .order('cancel_status', { ascending: true })
          .order('pending_cancel_date', { ascending: true, nullsFirst: false });
      } else if (sortBy === 'original_year') {
        query = query.order('renewal_effective_date', { ascending: false, nullsFirst: false });
      } else if (sortBy === 'policy_number') {
        query = query.order('policy_number', { ascending: true });
      } else if (sortBy === 'premium') {
        query = query.order('premium_cents', { ascending: false, nullsFirst: false });
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
        
        const { cancel_audit_activities, ...cleanRecord } = record as any;
        
        return {
          ...cleanRecord,
          activity_count: activities.length,
          last_activity_at: sortedActivities[0]?.created_at || null,
          household_policy_count: householdPolicyCounts.get(record.household_key) || 1,
          is_active: record.is_active,
        } as RecordWithActivityCount;
      });
    },
    enabled: !!agencyId,
    staleTime: 30000,
  });
}

function applyCancelStatusFilter(query: any, cancelStatusFilter: CancelStatusFilter) {
  switch (cancelStatusFilter) {
    case 'cancel':
      return query.or("cancel_status.ilike.Cancel,and(cancel_status.is.null,report_type.eq.pending_cancel)");
    case 'cancelled':
      return query.or("cancel_status.ilike.Cancelled,and(cancel_status.is.null,report_type.eq.cancellation)");
    case 's-cancel':
      return query.ilike('cancel_status', 'S-cancel');
    case 'saved':
      return query.ilike('cancel_status', 'Saved');
    case 'unmatched':
      return query.is('cancel_status', null);
    default:
      return query;
  }
}
