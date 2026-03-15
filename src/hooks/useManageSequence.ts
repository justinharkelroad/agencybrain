import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type SequenceAction = 'complete' | 'pause' | 'resume';

interface ManageSequenceParams {
  instanceId: string;
  action: SequenceAction;
  agencyId: string;
  completedByUserId?: string | null;
  completedByStaffId?: string | null;
  notes?: string;
  staffSessionToken?: string | null;
}

interface ManageSequenceResult {
  success: boolean;
  tasks_completed?: number;
  message?: string;
}

export function useManageSequence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: ManageSequenceParams): Promise<ManageSequenceResult> => {
      const { data, error } = await supabase.rpc('manage_sequence_instance', {
        p_instance_id: params.instanceId,
        p_action: params.action,
        p_agency_id: params.agencyId,
        p_completed_by_user_id: params.completedByUserId || null,
        p_completed_by_staff_id: params.completedByStaffId || null,
        p_notes: params.notes || null,
        p_staff_session_token: params.staffSessionToken || null,
      });

      if (error) throw error;
      return data as ManageSequenceResult;
    },
    onSuccess: (data, params) => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['onboarding-tasks-today'] });
      queryClient.invalidateQueries({ queryKey: ['staff-onboarding-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['contact-sequence-progress'] });
      queryClient.invalidateQueries({ queryKey: ['contact-profile'] });
      queryClient.invalidateQueries({ queryKey: ['overdue-task-count'] });
      queryClient.invalidateQueries({ queryKey: ['staff-overdue-task-count'] });
      queryClient.invalidateQueries({ queryKey: ['sequence-team-stats'] });

      const actionLabel =
        params.action === 'complete' ? 'completed' :
        params.action === 'pause' ? 'paused' : 'resumed';

      if (params.action === 'complete' && data.tasks_completed) {
        toast.success(`Sequence ${actionLabel} — ${data.tasks_completed} task(s) marked done`);
      } else {
        toast.success(`Sequence ${actionLabel}`);
      }
    },
    onError: (error) => {
      console.error('[useManageSequence] Error:', error);
      toast.error('Failed to update sequence');
    },
  });
}
