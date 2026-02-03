import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

type ActionType = 'call' | 'text' | 'email' | 'other';

export interface ScheduleAdhocTaskParams {
  contactId: string;
  dueDate: string; // YYYY-MM-DD format
  actionType: ActionType;
  title: string;
  description?: string;
  parentTaskId?: string;
}

interface ScheduleAdhocTaskResponse {
  success: boolean;
  task: {
    id: string;
    agency_id: string;
    contact_id: string;
    is_adhoc: boolean;
    parent_task_id: string | null;
    assigned_to_staff_user_id: string | null;
    assigned_to_user_id: string | null;
    day_number: number;
    action_type: ActionType;
    title: string;
    description: string | null;
    due_date: string;
    status: string;
    created_at: string;
    updated_at: string;
  };
  contact_name: string;
}

interface UseScheduleAdhocTaskOptions {
  staffSessionToken?: string | null;
}

/**
 * Hook to create an adhoc (standalone) task
 * Supports both JWT auth (for agency owners/managers) and staff session auth (for staff portal)
 */
export function useScheduleAdhocTask(options: UseScheduleAdhocTaskOptions = {}) {
  const queryClient = useQueryClient();
  const { staffSessionToken } = options;

  return useMutation({
    mutationFn: async (params: ScheduleAdhocTaskParams): Promise<ScheduleAdhocTaskResponse> => {
      // Build headers - include staff session if available
      const headers: Record<string, string> = {};
      if (staffSessionToken) {
        headers['x-staff-session'] = staffSessionToken;
      }

      const { data, error } = await supabase.functions.invoke('create_adhoc_task', {
        headers,
        body: {
          contact_id: params.contactId,
          due_date: params.dueDate,
          action_type: params.actionType,
          title: params.title,
          description: params.description || null,
          parent_task_id: params.parentTaskId || null,
        },
      });

      if (error) {
        console.error('[useScheduleAdhocTask] Edge function error:', error);
        throw error;
      }

      if (data?.error) {
        console.error('[useScheduleAdhocTask] API error:', data.error);
        throw new Error(data.error);
      }

      return data as ScheduleAdhocTaskResponse;
    },
    onSuccess: () => {
      // Invalidate task queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ['staff-onboarding-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['staff-overdue-task-count'] });
      queryClient.invalidateQueries({ queryKey: ['onboarding-tasks'] });
    },
  });
}
