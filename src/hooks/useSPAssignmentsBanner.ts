import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getUnseenSPAssignments, markSPAssignmentsSeen, UnseenSPResult } from '@/lib/spAssignmentAdminApi';
import { useStaffAuth } from './useStaffAuth';

const EMPTY: UnseenSPResult = { count: 0, assignments: [] };

export function useSPAssignmentsBanner() {
  const { user, sessionToken } = useStaffAuth();
  const queryClient = useQueryClient();
  const staffUserId = user?.id;

  const { data = EMPTY } = useQuery({
    queryKey: ['sp-assignments-unseen', staffUserId],
    queryFn: () => getUnseenSPAssignments(staffUserId!),
    enabled: !!staffUserId && !!sessionToken,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const dismiss = async () => {
    await markSPAssignmentsSeen();
    queryClient.setQueryData(['sp-assignments-unseen', staffUserId], EMPTY);
  };

  // Build the target path based on level
  let targetPath = '/staff/training/standard';
  if (data.count === 1) {
    const a = data.assignments[0];
    if (a?.level === 'category' && a.category_slug) {
      targetPath = `/staff/training/standard/${a.category_slug}`;
    } else if (a?.level === 'module' && a.category_slug) {
      // Module-level: navigate to category page (which lists modules)
      targetPath = `/staff/training/standard/${a.category_slug}`;
    } else if (a?.level === 'lesson' && a.category_slug && a.module_slug && a.lesson_slug) {
      // Lesson-level: navigate directly to the lesson
      targetPath = `/staff/training/standard/${a.category_slug}/${a.module_slug}/${a.lesson_slug}`;
    } else if (a?.level === 'lesson' && a.category_slug) {
      // Fallback: at least navigate to category
      targetPath = `/staff/training/standard/${a.category_slug}`;
    }
  }

  // For banner text: show the target name (works for any level)
  const singleName = data.count === 1
    ? (data.assignments[0]?.target_name || data.assignments[0]?.category_name)
    : null;

  return {
    unseenCount: data.count,
    assignments: data.assignments,
    targetPath,
    singleName,
    dismiss,
  };
}
