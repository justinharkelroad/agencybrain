import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/auth';

export interface SalesExperienceAssignment {
  id: string;
  agency_id: string;
  start_date: string;
  end_date: string;
  status: 'pending' | 'active' | 'paused' | 'completed' | 'cancelled';
  timezone: string;
  notes: string | null;
  created_at: string;
}

export interface SalesExperienceAccess {
  hasAccess: boolean;
  assignment: SalesExperienceAssignment | null;
  currentWeek: number;
  isActive: boolean;
  isPending: boolean;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Calculate the current week number based on the assignment start date
 * Week 1 = business days 1-5, Week 2 = business days 6-10, etc.
 */
function calculateCurrentWeek(startDate: string): number {
  const start = new Date(startDate);
  const today = new Date();

  // Normalize to start of day
  start.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  if (today < start) return 0;

  // Count business days between start and today
  let businessDays = 0;
  const current = new Date(start);

  while (current <= today) {
    const dayOfWeek = current.getDay();
    // 0 = Sunday, 6 = Saturday
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      businessDays++;
    }
    current.setDate(current.getDate() + 1);
  }

  // Week 1 = days 1-5, Week 2 = days 6-10, etc.
  // Cap at 8 weeks max
  return Math.min(8, Math.max(1, Math.ceil(businessDays / 5)));
}

/**
 * Hook to check if the current user has access to the Sales Experience program.
 * Returns access status, the active assignment, and current week number.
 *
 * Access is granted to agency owners/managers whose agency has an active assignment.
 */
export function useSalesExperienceAccess(): SalesExperienceAccess {
  const { user, isAgencyOwner, isKeyEmployee, keyEmployeeAgencyId, isAdmin } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ['sales-experience-access', user?.id],
    enabled: !!user && (isAgencyOwner || isKeyEmployee || isAdmin),
    staleTime: 5 * 60 * 1000, // 5 minutes
    queryFn: async () => {
      // First, get the user's agency ID
      let agencyId: string | null = null;

      if (isKeyEmployee && keyEmployeeAgencyId) {
        agencyId = keyEmployeeAgencyId;
      } else if (isAgencyOwner) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('agency_id')
          .eq('id', user!.id)
          .single();

        if (profileError || !profile?.agency_id) {
          return { assignment: null };
        }
        agencyId = profile.agency_id;
      } else if (isAdmin) {
        // Admins can access but don't have a personal assignment
        // They'll access via admin routes
        return { assignment: null };
      }

      if (!agencyId) {
        return { assignment: null };
      }

      // Check for an active or pending assignment for this agency
      const { data: assignment, error: assignmentError } = await supabase
        .from('sales_experience_assignments')
        .select('*')
        .eq('agency_id', agencyId)
        .in('status', ['pending', 'active'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (assignmentError) {
        console.error('[useSalesExperienceAccess] Error fetching assignment:', assignmentError);
        throw assignmentError;
      }

      return { assignment };
    },
  });

  const assignment = data?.assignment ?? null;
  const isActive = assignment?.status === 'active';
  const isPending = assignment?.status === 'pending';
  const currentWeek = assignment && isActive
    ? calculateCurrentWeek(assignment.start_date)
    : 0;

  return {
    hasAccess: !!assignment,
    assignment,
    currentWeek,
    isActive,
    isPending,
    isLoading,
    error: error as Error | null,
  };
}

/**
 * Calculate which lesson day is currently unlocked for staff
 * Mon (day_of_week=1) unlocks on day 1 of week
 * Wed (day_of_week=3) unlocks on day 3 of week
 * Fri (day_of_week=5) unlocks on day 5 of week
 */
export function isLessonUnlocked(
  startDate: string,
  lessonWeekNumber: number,
  lessonDayOfWeek: number
): boolean {
  const start = new Date(startDate);
  const today = new Date();

  // Normalize to start of day
  start.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  if (today < start) return false;

  // Count business days
  let businessDays = 0;
  const current = new Date(start);

  while (current <= today) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      businessDays++;
    }
    current.setDate(current.getDate() + 1);
  }

  // Which week are we in? (1-indexed)
  const currentWeek = Math.max(1, Math.ceil(businessDays / 5));

  // What day in the current week? (1-5)
  const dayInWeek = ((businessDays - 1) % 5) + 1;

  // If past this lesson's week, it's unlocked
  if (currentWeek > lessonWeekNumber) return true;

  // If before this lesson's week, it's locked
  if (currentWeek < lessonWeekNumber) return false;

  // Same week: check if we've reached the day
  // Mon=1, Wed=3, Fri=5
  return dayInWeek >= lessonDayOfWeek;
}
