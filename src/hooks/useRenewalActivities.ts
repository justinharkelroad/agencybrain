import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { RenewalActivity, ActivityType, WorkflowStatus } from '@/types/renewal';

export function useRenewalActivities(renewalRecordId: string | null) {
  return useQuery({
    queryKey: ['renewal-activities', renewalRecordId],
    queryFn: async () => {
      if (!renewalRecordId) return [];
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
  
  return useMutation({
    mutationFn: async (params: CreateActivityParams) => {
      // Get display name from profiles table for accuracy
      let displayName = params.displayName;
      if (params.userId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('id', params.userId)
          .single();
        if (profile?.display_name) {
          displayName = profile.display_name;
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
    onSuccess: (_, { renewalRecordId }) => {
      queryClient.invalidateQueries({ queryKey: ['renewal-activities', renewalRecordId] });
      queryClient.invalidateQueries({ queryKey: ['renewal-records'] });
      queryClient.invalidateQueries({ queryKey: ['renewal-stats'] });
      toast.success('Activity logged');
    },
    onError: () => toast.error('Failed to log activity'),
  });
}
