import { useQuery } from '@tanstack/react-query';

/**
 * Hook to get the count of overdue onboarding tasks for the current user (Brain portal).
 * Used for the sidebar badge notification.
 *
 * NOTE: This hook is currently disabled because the staff_users.linked_profile_id column
 * does not exist in the database. The query was causing 400 errors on every page load.
 * To re-enable, first create the linked_profile_id column on staff_users table.
 */
export function useOverdueTaskCount() {
  return useQuery({
    queryKey: ['overdue-task-count-disabled'],
    queryFn: async () => {
      // DISABLED: linked_profile_id column doesn't exist on staff_users table
      // This was causing 400 errors on every page load
      return 0;
    },
    enabled: false, // Disabled until linked_profile_id column is created
    staleTime: Infinity,
  });
}
