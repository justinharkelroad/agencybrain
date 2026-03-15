import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useStaffAuth } from '@/hooks/useStaffAuth';
import { format } from 'date-fns';
import { todayLocal } from '@/lib/utils';

export type TaskStatus = 'pending' | 'due' | 'overdue' | 'completed';
export type ActionType = 'call' | 'text' | 'email' | 'other';

export interface StaffOnboardingTask {
  id: string;
  instance_id: string | null;
  step_id: string | null;
  agency_id: string;
  assigned_to_staff_user_id: string;
  day_number: number;
  action_type: ActionType;
  title: string;
  description: string | null;
  script_template: string | null;
  due_date: string;
  status: TaskStatus;
  completed_at: string | null;
  completed_by_user_id: string | null;
  completed_by_staff_user_id: string | null;
  completion_notes: string | null;
  created_at: string;
  updated_at: string;
  // Adhoc task fields
  is_adhoc?: boolean;
  contact_id?: string | null;
  parent_task_id?: string | null;
  // Joined fields
  instance?: {
    id: string;
    customer_name: string;
    customer_phone: string | null;
    customer_email: string | null;
    sale_id: string;
    contact_id: string | null;
    sequence?: {
      id: string;
      name: string;
    };
  };
  // Assignee join (included when manager views all)
  assignee?: {
    id: string;
    display_name: string | null;
    username: string;
  } | null;
  // Direct contact join for adhoc tasks
  contact?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    phones: string[];
    emails: string[];
  };
}

export interface StaffTaskStats {
  overdue: number;
  due_today: number;
  upcoming: number;
  completed_today: number;
}

interface StaffListItem {
  id: string;
  display_name: string | null;
  username: string;
  is_active: boolean;
}

interface StaffTasksResponse {
  active_tasks: StaffOnboardingTask[];
  completed_today_tasks: StaffOnboardingTask[];
  stats: StaffTaskStats;
  staff_user_id: string;
  agency_id: string;
  viewing_all?: boolean;
  target_staff_id?: string;
  staff_list?: StaffListItem[];
}

/**
 * Hook to fetch onboarding tasks for the current staff user (or all agency tasks for managers)
 * Uses edge function with X-Staff-Session authentication
 */
export function useStaffOnboardingTasks(options?: { viewAll?: boolean; viewStaffId?: string | null }) {
  const { sessionToken, user } = useStaffAuth();
  const today = format(todayLocal(), 'yyyy-MM-dd');
  const viewAll = options?.viewAll || false;
  const viewStaffId = options?.viewStaffId || null;

  const query = useQuery({
    queryKey: ['staff-onboarding-tasks', user?.id, today, viewAll, viewStaffId],
    queryFn: async (): Promise<StaffTasksResponse> => {
      if (!sessionToken) {
        throw new Error('No session token');
      }

      const { data, error } = await supabase.functions.invoke('get_staff_onboarding_tasks', {
        headers: { 'x-staff-session': sessionToken },
        body: {
          include_completed_today: true,
          view_all: viewAll,
          view_staff_id: viewStaffId,
        },
      });

      if (error) {
        console.error('[useStaffOnboardingTasks] Edge function error:', error);
        throw error;
      }

      if (data?.error) {
        console.error('[useStaffOnboardingTasks] API error:', data.error);
        throw new Error(data.error);
      }

      return data as StaffTasksResponse;
    },
    enabled: !!sessionToken && !!user?.id,
    refetchInterval: 60000, // Refresh every minute
  });

  return {
    activeTasks: query.data?.active_tasks || [],
    completedTodayTasks: query.data?.completed_today_tasks || [],
    stats: query.data?.stats || { overdue: 0, due_today: 0, upcoming: 0, completed_today: 0 },
    staffList: query.data?.staff_list || [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Hook to complete a task (Staff Portal version)
 * Uses edge function with X-Staff-Session authentication
 */
export function useCompleteStaffOnboardingTask() {
  const queryClient = useQueryClient();
  const { sessionToken } = useStaffAuth();

  return useMutation({
    mutationFn: async ({ taskId, notes, callOutcome }: { taskId: string; notes?: string; callOutcome?: string }) => {
      if (!sessionToken) {
        throw new Error('No session token');
      }

      const { data, error } = await supabase.functions.invoke('complete_staff_onboarding_task', {
        headers: { 'x-staff-session': sessionToken },
        body: {
          task_id: taskId,
          notes: notes || null,
          call_outcome: callOutcome || null,
        },
      });

      if (error) {
        console.error('[useCompleteStaffOnboardingTask] Edge function error:', error);
        throw error;
      }

      if (data?.error) {
        console.error('[useCompleteStaffOnboardingTask] API error:', data.error);
        throw new Error(data.error);
      }

      return data;
    },
    onSuccess: () => {
      // Invalidate task queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ['staff-onboarding-tasks'] });
      // Also invalidate the overdue count for the sidebar badge
      queryClient.invalidateQueries({ queryKey: ['staff-overdue-task-count'] });
      // Refresh team accountability dashboard (staff completions affect it too)
      queryClient.invalidateQueries({ queryKey: ['sequence-team-stats'] });
    },
  });
}
