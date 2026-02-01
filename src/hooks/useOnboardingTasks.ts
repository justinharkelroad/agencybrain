import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { todayLocal } from '@/lib/utils';

export type TaskStatus = 'pending' | 'due' | 'overdue' | 'completed';
export type ActionType = 'call' | 'text' | 'email' | 'other';

export interface OnboardingTask {
  id: string;
  instance_id: string;
  step_id: string | null;
  agency_id: string;
  assigned_to_staff_user_id: string | null;
  assigned_to_user_id: string | null;
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
  // Assignee can be staff user or profile user
  assignee?: {
    id: string;
    display_name: string | null;
    username: string;
  } | null;
  assigneeProfile?: {
    id: string;
    full_name: string | null;
    email: string | null;
  } | null;
}

export interface TaskFilters {
  assigneeId?: string | null;
  assigneeUserId?: string | null; // For profile-based filtering
  status?: TaskStatus | 'active' | 'all';
  includeCompleted?: boolean;
}

interface UseOnboardingTasksOptions {
  agencyId: string | null;
  filters?: TaskFilters;
  enabled?: boolean;
}

export function useOnboardingTasks({ agencyId, filters = {}, enabled = true }: UseOnboardingTasksOptions) {
  const query = useQuery({
    queryKey: ['onboarding-tasks', agencyId, filters],
    queryFn: async () => {
      if (!agencyId) return [];

      let query = supabase
        .from('onboarding_tasks')
        .select(`
          *,
          instance:onboarding_instances!inner(
            id,
            customer_name,
            customer_phone,
            customer_email,
            sale_id,
            sequence:onboarding_sequences(id, name)
          ),
          assignee:staff_users!assigned_to_staff_user_id(id, display_name, username),
          assigneeProfile:profiles!assigned_to_user_id(id, full_name, email)
        `)
        .eq('agency_id', agencyId)
        .order('due_date', { ascending: true })
        .order('created_at', { ascending: true });

      // Filter by staff assignee if specified
      if (filters.assigneeId) {
        query = query.eq('assigned_to_staff_user_id', filters.assigneeId);
      }

      // Filter by user profile assignee if specified
      if (filters.assigneeUserId) {
        query = query.eq('assigned_to_user_id', filters.assigneeUserId);
      }

      // Filter by status
      if (filters.status === 'active') {
        // Active = pending, due, or overdue (not completed)
        query = query.in('status', ['pending', 'due', 'overdue']);
      } else if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      // Include/exclude completed tasks
      if (!filters.includeCompleted && filters.status !== 'completed' && filters.status !== 'all') {
        query = query.neq('status', 'completed');
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as OnboardingTask[];
    },
    enabled: enabled && !!agencyId,
  });

  return {
    tasks: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

// Hook to get tasks for today's view (active + completed today)
export function useOnboardingTasksToday({ 
  agencyId, 
  assigneeId,
  assigneeUserId,
}: { 
  agencyId: string | null; 
  assigneeId?: string | null;
  assigneeUserId?: string | null;
}) {
  const today = format(todayLocal(), 'yyyy-MM-dd');

  const query = useQuery({
    queryKey: ['onboarding-tasks-today', agencyId, assigneeId, assigneeUserId, today],
    queryFn: async () => {
      if (!agencyId) return { active: [], completedToday: [] };

      // Fetch active tasks (pending, due, overdue)
      let activeQuery = supabase
        .from('onboarding_tasks')
        .select(`
          *,
          instance:onboarding_instances!inner(
            id,
            customer_name,
            customer_phone,
            customer_email,
            sale_id,
            sequence:onboarding_sequences(id, name)
          ),
          assignee:staff_users!assigned_to_staff_user_id(id, display_name, username),
          assigneeProfile:profiles!assigned_to_user_id(id, full_name, email)
        `)
        .eq('agency_id', agencyId)
        .in('status', ['pending', 'due', 'overdue'])
        .order('due_date', { ascending: true })
        .order('created_at', { ascending: true });

      if (assigneeId) {
        activeQuery = activeQuery.eq('assigned_to_staff_user_id', assigneeId);
      }
      
      if (assigneeUserId) {
        activeQuery = activeQuery.eq('assigned_to_user_id', assigneeUserId);
      }

      // Fetch tasks completed today
      let completedQuery = supabase
        .from('onboarding_tasks')
        .select(`
          *,
          instance:onboarding_instances!inner(
            id,
            customer_name,
            customer_phone,
            customer_email,
            sale_id,
            sequence:onboarding_sequences(id, name)
          ),
          assignee:staff_users!assigned_to_staff_user_id(id, display_name, username),
          assigneeProfile:profiles!assigned_to_user_id(id, full_name, email)
        `)
        .eq('agency_id', agencyId)
        .eq('status', 'completed')
        .gte('completed_at', `${today}T00:00:00`)
        .lt('completed_at', `${today}T23:59:59.999`)
        .order('completed_at', { ascending: false });

      if (assigneeId) {
        completedQuery = completedQuery.eq('assigned_to_staff_user_id', assigneeId);
      }
      
      if (assigneeUserId) {
        completedQuery = completedQuery.eq('assigned_to_user_id', assigneeUserId);
      }

      const [activeResult, completedResult] = await Promise.all([
        activeQuery,
        completedQuery,
      ]);

      if (activeResult.error) throw activeResult.error;
      if (completedResult.error) throw completedResult.error;

      return {
        active: (activeResult.data || []) as OnboardingTask[],
        completedToday: (completedResult.data || []) as OnboardingTask[],
      };
    },
    enabled: !!agencyId,
  });

  return {
    activeTasks: query.data?.active || [],
    completedTodayTasks: query.data?.completedToday || [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

// Hook for completing a task
export function useCompleteOnboardingTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, notes }: { taskId: string; notes?: string }) => {
      const { data, error } = await supabase.functions.invoke('complete_onboarding_task', {
        body: {
          task_id: taskId,
          notes: notes || null,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return data;
    },
    onSuccess: () => {
      // Invalidate all task queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ['onboarding-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['onboarding-tasks-today'] });
      // Also invalidate the overdue count for the sidebar badge
      queryClient.invalidateQueries({ queryKey: ['overdue-task-count'] });
    },
  });
}

// Hook to get staff users for filtering
export function useStaffUsersForFilter(agencyId: string | null) {
  return useQuery({
    queryKey: ['staff-users-filter', agencyId],
    queryFn: async () => {
      if (!agencyId) return [];

      const { data, error } = await supabase
        .from('staff_users')
        .select('id, display_name, username, is_active')
        .eq('agency_id', agencyId)
        .eq('is_active', true)
        .order('display_name');

      if (error) throw error;
      return data || [];
    },
    enabled: !!agencyId,
  });
}

// Hook to get profile users (owners/managers) for filtering
export function useProfileUsersForFilter(agencyId: string | null) {
  return useQuery({
    queryKey: ['profile-users-filter', agencyId],
    queryFn: async () => {
      if (!agencyId) return [];

      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .eq('agency_id', agencyId)
        .order('full_name');

      if (error) throw error;
      return data || [];
    },
    enabled: !!agencyId,
  });
}
