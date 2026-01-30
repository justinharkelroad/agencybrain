import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useStaffAuth } from '@/hooks/useStaffAuth';
import { format } from 'date-fns';
import { todayLocal } from '@/lib/utils';

export type TaskStatus = 'pending' | 'due' | 'overdue' | 'completed';
export type ActionType = 'call' | 'text' | 'email' | 'other';

export interface StaffOnboardingTask {
  id: string;
  instance_id: string;
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
  completed_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  instance?: {
    id: string;
    customer_name: string;
    customer_phone: string | null;
    customer_email: string | null;
    sale_id: string;
    sequence?: {
      id: string;
      name: string;
    };
  };
}

export interface StaffTaskStats {
  overdue: number;
  due_today: number;
  upcoming: number;
  completed_today: number;
}

interface StaffTasksResponse {
  active_tasks: StaffOnboardingTask[];
  completed_today_tasks: StaffOnboardingTask[];
  stats: StaffTaskStats;
  staff_user_id: string;
  agency_id: string;
}

/**
 * Hook to fetch onboarding tasks for the current staff user
 * Uses edge function with X-Staff-Session authentication
 */
export function useStaffOnboardingTasks() {
  const { sessionToken, user } = useStaffAuth();
  const today = format(todayLocal(), 'yyyy-MM-dd');

  const query = useQuery({
    queryKey: ['staff-onboarding-tasks', user?.id, today],
    queryFn: async (): Promise<StaffTasksResponse> => {
      if (!sessionToken) {
        throw new Error('No session token');
      }

      const { data, error } = await supabase.functions.invoke('get_staff_onboarding_tasks', {
        headers: { 'x-staff-session': sessionToken },
        body: { include_completed_today: true },
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
    mutationFn: async ({ taskId, notes }: { taskId: string; notes?: string }) => {
      if (!sessionToken) {
        throw new Error('No session token');
      }

      const { data, error } = await supabase.functions.invoke('complete_staff_onboarding_task', {
        headers: { 'x-staff-session': sessionToken },
        body: {
          task_id: taskId,
          notes: notes || null,
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
    },
  });
}
