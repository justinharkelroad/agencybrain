import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useStaffAuth } from '@/hooks/useStaffAuth';
import type { ActionType } from '@/hooks/useStaffOnboardingTasks';

export interface CreateAdhocTaskParams {
  contactId: string;
  dueDate: string; // YYYY-MM-DD format
  actionType: ActionType;
  title: string;
  description?: string;
  parentTaskId?: string;
}

interface CreateAdhocTaskResponse {
  success: boolean;
  task: {
    id: string;
    agency_id: string;
    contact_id: string;
    is_adhoc: boolean;
    parent_task_id: string | null;
    assigned_to_staff_user_id: string;
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

/**
 * Hook to create an adhoc (standalone) follow-up task
 * Uses edge function with X-Staff-Session authentication
 */
export function useCreateAdhocTask() {
  const queryClient = useQueryClient();
  const { sessionToken } = useStaffAuth();

  return useMutation({
    mutationFn: async (params: CreateAdhocTaskParams): Promise<CreateAdhocTaskResponse> => {
      if (!sessionToken) {
        throw new Error('No session token');
      }

      const { data, error } = await supabase.functions.invoke('create_adhoc_task', {
        headers: { 'x-staff-session': sessionToken },
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
        console.error('[useCreateAdhocTask] Edge function error:', error);
        throw error;
      }

      if (data?.error) {
        console.error('[useCreateAdhocTask] API error:', data.error);
        throw new Error(data.error);
      }

      return data as CreateAdhocTaskResponse;
    },
    onSuccess: () => {
      // Invalidate task queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ['staff-onboarding-tasks'] });
      // Also invalidate the overdue count for the sidebar badge
      queryClient.invalidateQueries({ queryKey: ['staff-overdue-task-count'] });
    },
  });
}
