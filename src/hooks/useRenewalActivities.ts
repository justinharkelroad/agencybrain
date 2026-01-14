import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { RenewalActivity, ActivityType, WorkflowStatus } from '@/types/renewal';
import { getStaffSessionToken } from '@/lib/cancel-audit-api';
import { format, startOfDay, isToday } from 'date-fns';

export function useRenewalActivities(renewalRecordId: string | null) {
  const staffSessionToken = getStaffSessionToken();
  
  return useQuery({
    queryKey: ['renewal-activities', renewalRecordId, !!staffSessionToken],
    queryFn: async () => {
      if (!renewalRecordId) return [];
      
      // Staff users: call edge function to bypass RLS
      if (staffSessionToken) {
        console.log('[useRenewalActivities] Staff user detected, calling edge function');
        const { data, error } = await supabase.functions.invoke('get_staff_renewal_activities', {
          body: { renewalRecordId },
          headers: { 'x-staff-session': staffSessionToken }
        });
        
        if (error) {
          console.error('[useRenewalActivities] Edge function error:', error);
          throw error;
        }
        
        return (data?.activities || []) as RenewalActivity[];
      }
      
      // Regular users: direct query
      const { data, error } = await supabase
        .from('renewal_activities')
        .select('*')
        .eq('renewal_record_id', renewalRecordId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as RenewalActivity[];
    },
    enabled: !!renewalRecordId,
  });
}

interface CreateActivityParams {
  renewalRecordId: string;
  agencyId: string;
  activityType: ActivityType;
  activityStatus?: string;
  subject?: string;
  comments?: string;
  scheduledDate?: Date;
  sendCalendarInvite?: boolean;
  assignedTeamMemberId?: string;
  displayName: string;
  userId: string | null;
  updateRecordStatus?: WorkflowStatus;
}

export function useCreateRenewalActivity() {
  const queryClient = useQueryClient();
  const staffSessionToken = getStaffSessionToken();
  
  return useMutation({
    mutationFn: async (params: CreateActivityParams) => {
      // Staff users: call edge function to bypass RLS
      if (staffSessionToken) {
        console.log('[useCreateRenewalActivity] Staff user detected, calling edge function');
        const { data, error } = await supabase.functions.invoke('log_staff_renewal_activity', {
          body: {
            renewalRecordId: params.renewalRecordId,
            activityType: params.activityType,
            activityStatus: params.activityStatus,
            subject: params.subject,
            comments: params.comments,
            scheduledDate: params.scheduledDate?.toISOString(),
            sendCalendarInvite: params.sendCalendarInvite,
            assignedTeamMemberId: params.assignedTeamMemberId,
            updateRecordStatus: params.updateRecordStatus,
          },
          headers: { 'x-staff-session': staffSessionToken }
        });
        
        if (error) {
          console.error('[useCreateRenewalActivity] Edge function error:', error);
          throw error;
        }
        
        if (data?.error) {
          throw new Error(data.error);
        }
        
        return;
      }
      
      // Regular users: direct Supabase call
      // Get display name from profiles table for accuracy
      let displayName = params.displayName;
      if (params.userId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', params.userId)
          .single();
        if (profile?.full_name) {
          displayName = profile.full_name;
        }
      }
      
      // Create activity
      const { error: activityError } = await supabase.from('renewal_activities').insert({
        renewal_record_id: params.renewalRecordId,
        agency_id: params.agencyId,
        activity_type: params.activityType,
        activity_status: params.activityStatus || null,
        subject: params.subject || null,
        comments: params.comments || null,
        scheduled_date: params.scheduledDate?.toISOString() || null,
        send_calendar_invite: params.sendCalendarInvite || false,
        assigned_team_member_id: params.assignedTeamMemberId || null,
        created_by: params.userId,
        created_by_display_name: displayName,
      });
      if (activityError) throw activityError;
      
      // Update parent record
      const recordUpdates: Record<string, any> = {
        last_activity_at: new Date().toISOString(),
        last_activity_by: params.userId,
        last_activity_by_display_name: displayName,
        updated_at: new Date().toISOString(),
      };
      if (params.updateRecordStatus) {
        recordUpdates.current_status = params.updateRecordStatus;
      }
      
      const { error: updateError } = await supabase.from('renewal_records')
        .update(recordUpdates)
        .eq('id', params.renewalRecordId);
      if (updateError) throw updateError;
    },
    onMutate: async (params) => {
      // Cancel any outgoing refetches for activity summary
      const todayStr = format(startOfDay(new Date()), 'yyyy-MM-dd');
      await queryClient.cancelQueries({ queryKey: ['renewal-activity-summary'] });

      // Snapshot the previous value for rollback
      const previousSummary = queryClient.getQueryData(['renewal-activity-summary', params.agencyId, todayStr, !!staffSessionToken]);

      // Optimistically add the new activity to today's summary
      queryClient.setQueryData(
        ['renewal-activity-summary', params.agencyId, todayStr, !!staffSessionToken],
        (old: any[] | undefined) => {
          const optimisticActivity = {
            id: 'temp-' + Date.now(),
            activity_type: params.activityType,
            created_by: params.userId,
            created_by_display_name: params.displayName,
            created_at: new Date().toISOString(),
          };
          return [optimisticActivity, ...(old || [])];
        }
      );

      return { previousSummary, todayStr };
    },
    onError: (err, params, context) => {
      // Rollback optimistic update on error
      if (context?.previousSummary) {
        queryClient.setQueryData(
          ['renewal-activity-summary', params.agencyId, context.todayStr, !!staffSessionToken],
          context.previousSummary
        );
      }
      toast.error('Failed to log activity');
    },
    onSuccess: (_, { renewalRecordId, agencyId }) => {
      queryClient.invalidateQueries({ queryKey: ['renewal-activities', renewalRecordId] });
      queryClient.invalidateQueries({ queryKey: ['renewal-records'] });
      queryClient.invalidateQueries({ queryKey: ['renewal-stats'] });
      // Invalidate activity summary for instant update (matches cancel audit behavior)
      queryClient.invalidateQueries({ queryKey: ['renewal-activity-summary'] });
      toast.success('Activity logged');
    },
  });
}
