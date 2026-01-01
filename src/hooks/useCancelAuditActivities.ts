import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ActivityType, CancelAuditActivity } from '@/types/cancel-audit';
import { callCancelAuditApi, getStaffSessionToken } from '@/lib/cancel-audit-api';

interface LogActivityParams {
  agencyId: string;
  recordId: string;
  householdKey: string;
  activityType: ActivityType;
  notes?: string;
  userId?: string;
  staffMemberId?: string;
  userDisplayName: string;
}

export function useLogActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: LogActivityParams) => {
      const staffSessionToken = getStaffSessionToken();

      // Staff portal: use edge function
      if (staffSessionToken) {
        return callCancelAuditApi({
          operation: "log_activity",
          params: {
            recordId: params.recordId,
            householdKey: params.householdKey,
            activityType: params.activityType,
            notes: params.notes,
            userDisplayName: params.userDisplayName,
          },
          sessionToken: staffSessionToken,
        });
      }

      // Regular auth: use direct Supabase query
      const { data, error } = await supabase
        .from('cancel_audit_activities')
        .insert({
          agency_id: params.agencyId,
          record_id: params.recordId,
          household_key: params.householdKey,
          activity_type: params.activityType,
          notes: params.notes || null,
          user_id: params.userId || null,
          staff_member_id: params.staffMemberId || null,
          user_display_name: params.userDisplayName,
        })
        .select()
        .single();

      if (error) throw error;

      // Determine what status to set based on activity type
      if (params.activityType === 'payment_made') {
        await supabase
          .from('cancel_audit_records')
          .update({ status: 'resolved', updated_at: new Date().toISOString() })
          .eq('agency_id', params.agencyId)
          .eq('household_key', params.householdKey);
      } else if (params.activityType === 'payment_promised') {
        await supabase
          .from('cancel_audit_records')
          .update({ status: 'in_progress', updated_at: new Date().toISOString() })
          .eq('agency_id', params.agencyId)
          .eq('household_key', params.householdKey)
          .in('status', ['new']);
      } else if (['attempted_call', 'voicemail_left', 'text_sent', 'email_sent', 'spoke_with_client'].includes(params.activityType)) {
        await supabase
          .from('cancel_audit_records')
          .update({ status: 'in_progress', updated_at: new Date().toISOString() })
          .eq('agency_id', params.agencyId)
          .eq('household_key', params.householdKey)
          .eq('status', 'new');
      }

      return data;
    },
    onMutate: async (params) => {
      await queryClient.cancelQueries({ queryKey: ['cancel-audit-activities', params.householdKey] });
      
      const previous = queryClient.getQueryData(['cancel-audit-activities', params.householdKey, params.agencyId]);
      
      queryClient.setQueryData(
        ['cancel-audit-activities', params.householdKey, params.agencyId],
        (old: CancelAuditActivity[] | undefined) => {
          const optimisticActivity: CancelAuditActivity = {
            id: 'temp-' + Date.now(),
            agency_id: params.agencyId,
            record_id: params.recordId,
            household_key: params.householdKey,
            user_id: params.userId || null,
            staff_member_id: params.staffMemberId || null,
            user_display_name: params.userDisplayName,
            activity_type: params.activityType,
            notes: params.notes || null,
            created_at: new Date().toISOString(),
          };
          return [optimisticActivity, ...(old || [])];
        }
      );
      
      return { previous };
    },
    onError: (err, params, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          ['cancel-audit-activities', params.householdKey, params.agencyId],
          context.previous
        );
      }
    },
    onSuccess: (_, params) => {
      queryClient.invalidateQueries({ queryKey: ['cancel-audit-records'] });
      queryClient.invalidateQueries({ queryKey: ['cancel-audit-activities', params.householdKey] });
      queryClient.invalidateQueries({ queryKey: ['cancel-audit-activities', params.recordId] });
      queryClient.invalidateQueries({ queryKey: ['cancel-audit-stats'] });
      queryClient.invalidateQueries({ queryKey: ['cancel-audit-counts'] });
      // Invalidate Hero Stats queries (partial match for all cancel-audit-hero-* keys)
      queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          typeof query.queryKey[0] === 'string' &&
          query.queryKey[0].startsWith('cancel-audit-hero-')
      });
    },
  });
}

export function useHouseholdActivities(householdKey: string | null, agencyId: string | null) {
  return useQuery({
    queryKey: ['cancel-audit-activities', householdKey, agencyId],
    queryFn: async (): Promise<CancelAuditActivity[]> => {
      if (!householdKey || !agencyId) return [];

      const staffSessionToken = getStaffSessionToken();

      // Staff portal: use edge function
      if (staffSessionToken) {
        return callCancelAuditApi({
          operation: "get_activities",
          params: { householdKey },
          sessionToken: staffSessionToken,
        });
      }

      // Regular auth: use direct Supabase query
      const { data, error } = await supabase
        .from('cancel_audit_activities')
        .select('*')
        .eq('agency_id', agencyId)
        .eq('household_key', householdKey)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as CancelAuditActivity[];
    },
    enabled: !!householdKey && !!agencyId,
  });
}

export function useRecordActivities(recordId: string | null) {
  return useQuery({
    queryKey: ['cancel-audit-activities', recordId],
    queryFn: async (): Promise<CancelAuditActivity[]> => {
      if (!recordId) return [];

      const staffSessionToken = getStaffSessionToken();

      // Staff portal: use edge function
      if (staffSessionToken) {
        return callCancelAuditApi({
          operation: "get_activities",
          params: { recordId },
          sessionToken: staffSessionToken,
        });
      }

      // Regular auth: use direct Supabase query
      const { data, error } = await supabase
        .from('cancel_audit_activities')
        .select('*')
        .eq('record_id', recordId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as CancelAuditActivity[];
    },
    enabled: !!recordId,
  });
}

export function useUpdateRecordStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ recordId, status, agencyId }: { recordId: string; status: string; agencyId?: string }) => {
      const staffSessionToken = getStaffSessionToken();

      // Staff portal: use edge function
      if (staffSessionToken) {
        return callCancelAuditApi({
          operation: "update_status",
          params: { recordId, status },
          sessionToken: staffSessionToken,
        });
      }

      // Regular auth: use direct Supabase query
      const { data, error } = await supabase
        .from('cancel_audit_records')
        .update({ status })
        .eq('id', recordId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cancel-audit-records'] });
      queryClient.invalidateQueries({ queryKey: ['cancel-audit-stats'] });
      // Invalidate Hero Stats queries (partial match for all cancel-audit-hero-* keys)
      queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          typeof query.queryKey[0] === 'string' &&
          query.queryKey[0].startsWith('cancel-audit-hero-')
      });
    },
  });
}
