import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/auth';

export type TrainingDateRange = { from: Date; to: Date } | null;

export interface StaffTrainingMember {
  id: string;
  displayName: string;
  email: string | null;
  lastLoginAt: string | null;
  lastActivityOverall: string | null;
  isActiveThisWeek: boolean;
  standardPlaybook: {
    lessonsStarted: number;
    lessonsCompleted: number;
    videosWatched: number;
    quizzesPassed: number;
    estimatedMinutes: number;
    videoWatchedSeconds: number;
    lastActivity: string | null;
  };
  agencyTraining: {
    lessonsStarted: number;
    lessonsCompleted: number;
    assignmentsTotal: number;
    assignmentsCompleted: number;
    estimatedMinutes: number;
    lastActivity: string | null;
  };
  challenge: {
    enrolled: boolean;
    lessonsCompleted: number;
    totalLessons: number;
    videoWatchedSeconds: number;
    reflectionsSubmitted: number;
    lastActivity: string | null;
  };
  salesExperience: {
    enrolled: boolean;
    lessonsCompleted: number;
    totalLessons: number;
    videoWatchedSeconds: number;
    lastActivity: string | null;
  };
  totalTimeMinutes: number;
  totalVideoSeconds: number;
}

export interface TrainingAnalyticsTotals {
  totalStaff: number;
  activeThisWeek: number;
  spLessonsCompleted: number;
  spLessonsStarted: number;
  agencyLessonsCompleted: number;
  agencyLessonsStarted: number;
  challengeLessonsCompleted: number;
  salesExpLessonsCompleted: number;
  totalVideoSeconds: number;
  totalEstimatedMinutes: number;
  spTotalAvailable: number;
  agencyTotalAvailable: number;
}

export interface TeamTrainingAnalytics {
  staffMembers: StaffTrainingMember[];
  totals: TrainingAnalyticsTotals;
}

type StandardPlaybookLessonRow = {
  id: string;
  estimated_minutes: number | null;
};

type AgencyTrainingLessonRow = {
  id: string;
  estimated_duration_minutes: number | null;
};

/** Compute elapsed minutes between started_at and completed_at timestamps. */
function elapsedMinutes(startedAt: string | null, completedAt: string | null): number {
  if (!startedAt || !completedAt) return 0;
  const diff = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  if (diff <= 0) return 0;
  // Cap at 4 hours per lesson to avoid outliers from leaving a tab open
  return Math.min(Math.round(diff / 60000), 240);
}

/** Check if any of the given timestamps fall within [fromIso, toIso]. */
function hasActivityInRange(timestamps: (string | null | undefined)[], fromIso: string, toIso: string): boolean {
  return timestamps.some(t => t != null && t >= fromIso && t <= toIso);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface RawTrainingData {
  staffUsers: any[];
  spProgress: any[];
  spLessons: StandardPlaybookLessonRow[];
  agencyProgress: any[];
  agencyAssignments: any[];
  agencyLessons: AgencyTrainingLessonRow[];
  challengeAssignments: any[];
  challengeProgress: any[];
  salesExpAssignments: any[];
  salesExpProgress: any[];
}

function computeAnalytics(raw: RawTrainingData, dateRange: TrainingDateRange): TeamTrainingAnalytics {
  const {
    staffUsers, spProgress, spLessons, agencyProgress, agencyAssignments,
    agencyLessons, challengeAssignments, challengeProgress,
    salesExpAssignments, salesExpProgress,
  } = raw;

  if (staffUsers.length === 0) {
    return { staffMembers: [], totals: emptyTotals() };
  }

  // Convert dateRange to ISO strings for comparison (to = end of day)
  let fromIso: string | null = null;
  let toIso: string | null = null;
  if (dateRange) {
    fromIso = dateRange.from.toISOString();
    const endOfDay = new Date(dateRange.to);
    endOfDay.setHours(23, 59, 59, 999);
    toIso = endOfDay.toISOString();
  }
  const filtering = fromIso != null && toIso != null;

  const spLessonMap = new Map(spLessons.map((l) => [l.id, l]));
  const agencyLessonMap = new Map(agencyLessons.map((l) => [l.id, l]));

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString();

  let totalActiveCount = 0;

  const staffMembers: StaffTrainingMember[] = staffUsers.map((staff) => {
    // --- Standard Playbook ---
    let staffSp = spProgress.filter((p) => p.staff_user_id === staff.id);
    if (filtering) {
      staffSp = staffSp.filter((p) => hasActivityInRange([p.completed_at, p.started_at], fromIso!, toIso!));
    }
    const spStarted = staffSp.filter((p) => p.started_at).length;
    const spCompleted = staffSp.filter((p) => p.quiz_passed === true).length;
    const spVideosWatched = staffSp.filter((p) => p.video_watched === true).length;
    const spQuizzesPassed = staffSp.filter((p) => p.quiz_passed === true).length;
    const spLastActivity = staffSp
      .map((p) => p.completed_at || p.started_at)
      .filter(Boolean)
      .sort()
      .reverse()[0] || null;
    const spVideoSeconds = staffSp.reduce(
      (sum, p) => sum + (p.video_watched_seconds || 0), 0
    );
    const spTimeMinutes = spVideoSeconds > 0
      ? Math.round(spVideoSeconds / 60)
      : staffSp
          .filter((p) => p.quiz_passed === true)
          .reduce((sum, p) => {
            const lesson = spLessonMap.get(p.lesson_id);
            return sum + (lesson?.estimated_minutes || 0);
          }, 0);

    // --- Agency Training ---
    let staffAgency = agencyProgress.filter((p) => p.staff_user_id === staff.id);
    if (filtering) {
      staffAgency = staffAgency.filter((p) => hasActivityInRange([p.completed_at, p.created_at], fromIso!, toIso!));
    }
    const staffAssigns = agencyAssignments.filter((a) => a.staff_user_id === staff.id);
    const agencyStarted = staffAgency.length;
    const agencyCompleted = staffAgency.filter((p) => p.completed === true).length;
    const assignmentsTotal = staffAssigns.length;
    const assignedLessonIds = new Set(staffAssigns.map((a) => a.lesson_id).filter(Boolean));
    const assignmentsCompleted = staffAgency.filter(
      (p) => p.completed === true && assignedLessonIds.has(p.lesson_id)
    ).length;
    const agencyLastActivity = staffAgency
      .map((p) => p.completed_at || p.created_at)
      .filter(Boolean)
      .sort()
      .reverse()[0] || null;
    const agencyTimeMinutes = staffAgency
      .filter((p) => p.completed === true)
      .reduce((sum, p) => {
        const elapsed = elapsedMinutes(p.created_at, p.completed_at);
        if (elapsed > 0) return sum + elapsed;
        const lesson = agencyLessonMap.get(p.lesson_id || '');
        return sum + (lesson?.estimated_duration_minutes || 0);
      }, 0);

    // --- Challenge ---
    const staffChallengeAssigns = challengeAssignments.filter(
      (a) => a.staff_user_id === staff.id
    );
    const enrolled = staffChallengeAssigns.length > 0;
    const assignmentIdSet = new Set(staffChallengeAssigns.map((a) => a.id));
    let staffChallenge = challengeProgress.filter(
      (p) => p.staff_user_id === staff.id && assignmentIdSet.has(p.assignment_id)
    );
    if (filtering) {
      staffChallenge = staffChallenge.filter((p) => hasActivityInRange([p.completed_at, p.started_at], fromIso!, toIso!));
    }
    const challengeCompleted = staffChallenge.filter((p) => p.status === 'completed').length;
    const challengeTotal = staffChallenge.length || (enrolled ? 30 : 0);
    const challengeVideoSeconds = staffChallenge.reduce(
      (sum, p) => sum + (p.video_watched_seconds || 0), 0
    );
    const reflectionsSubmitted = staffChallenge.filter(
      (p) => p.reflection_response && typeof p.reflection_response === 'object' && Object.keys(p.reflection_response).length > 0
    ).length;
    const challengeLastActivity = staffChallenge
      .map((p) => p.completed_at || p.started_at)
      .filter(Boolean)
      .sort()
      .reverse()[0] || null;

    // --- Sales Experience ---
    const salesAssignmentIds = new Set(salesExpAssignments.map((a) => a.id));
    const allStaffSalesProgress = salesExpProgress.filter(
      (p) => p.staff_user_id === staff.id && salesAssignmentIds.has(p.assignment_id)
    );
    // Enrollment is based on ALL progress, not filtered — don't flip to "Not enrolled" for a date range
    const salesEnrolled = salesExpAssignments.length > 0 && allStaffSalesProgress.length > 0;
    let staffSalesProgress = allStaffSalesProgress;
    if (filtering) {
      staffSalesProgress = staffSalesProgress.filter((p) => hasActivityInRange([p.completed_at, p.started_at], fromIso!, toIso!));
    }
    const salesCompleted = staffSalesProgress.filter((p) => p.status === 'completed').length;
    const salesTotal = staffSalesProgress.length;
    const salesVideoSeconds = staffSalesProgress.reduce(
      (sum, p) => sum + (p.video_watched_seconds || 0), 0
    );
    const salesLastActivity = staffSalesProgress
      .map((p) => p.completed_at || p.started_at)
      .filter(Boolean)
      .sort()
      .reverse()[0] || null;

    // Latest activity across ALL systems
    const allActivities = [spLastActivity, agencyLastActivity, challengeLastActivity, salesLastActivity].filter(Boolean) as string[];
    const lastActivityOverall = allActivities.sort().reverse()[0] || null;

    // When filtering by date range, "active" means had activity in that range.
    // When not filtering, "active" means had activity in last 7 days.
    const isActiveThisWeek = filtering
      ? lastActivityOverall != null
      : !!lastActivityOverall && lastActivityOverall >= sevenDaysAgoStr;
    if (isActiveThisWeek) totalActiveCount++;

    const totalVideoSeconds = spVideoSeconds + challengeVideoSeconds + salesVideoSeconds;
    const totalTimeMinutes = spTimeMinutes + agencyTimeMinutes + Math.round((challengeVideoSeconds + salesVideoSeconds) / 60);

    return {
      id: staff.id,
      displayName: staff.display_name,
      email: staff.email,
      lastLoginAt: staff.last_login_at,
      lastActivityOverall,
      isActiveThisWeek,
      standardPlaybook: {
        lessonsStarted: spStarted,
        lessonsCompleted: spCompleted,
        videosWatched: spVideosWatched,
        quizzesPassed: spQuizzesPassed,
        estimatedMinutes: spTimeMinutes,
        videoWatchedSeconds: spVideoSeconds,
        lastActivity: spLastActivity,
      },
      agencyTraining: {
        lessonsStarted: agencyStarted,
        lessonsCompleted: agencyCompleted,
        assignmentsTotal,
        assignmentsCompleted,
        estimatedMinutes: agencyTimeMinutes,
        lastActivity: agencyLastActivity,
      },
      challenge: {
        enrolled,
        lessonsCompleted: challengeCompleted,
        totalLessons: challengeTotal,
        videoWatchedSeconds: challengeVideoSeconds,
        reflectionsSubmitted,
        lastActivity: challengeLastActivity,
      },
      salesExperience: {
        enrolled: salesEnrolled,
        lessonsCompleted: salesCompleted,
        totalLessons: salesTotal,
        videoWatchedSeconds: salesVideoSeconds,
        lastActivity: salesLastActivity,
      },
      totalTimeMinutes,
      totalVideoSeconds,
    };
  });

  const totals: TrainingAnalyticsTotals = {
    totalStaff: staffUsers.length,
    activeThisWeek: totalActiveCount,
    spLessonsCompleted: staffMembers.reduce((s, m) => s + m.standardPlaybook.lessonsCompleted, 0),
    spLessonsStarted: staffMembers.reduce((s, m) => s + m.standardPlaybook.lessonsStarted, 0),
    agencyLessonsCompleted: staffMembers.reduce((s, m) => s + m.agencyTraining.lessonsCompleted, 0),
    agencyLessonsStarted: staffMembers.reduce((s, m) => s + m.agencyTraining.lessonsStarted, 0),
    challengeLessonsCompleted: staffMembers.reduce((s, m) => s + m.challenge.lessonsCompleted, 0),
    salesExpLessonsCompleted: staffMembers.reduce((s, m) => s + m.salesExperience.lessonsCompleted, 0),
    totalVideoSeconds: staffMembers.reduce((s, m) => s + m.totalVideoSeconds, 0),
    totalEstimatedMinutes: staffMembers.reduce((s, m) => s + m.totalTimeMinutes, 0),
    spTotalAvailable: spLessons.length,
    agencyTotalAvailable: agencyLessons.length,
  };

  return { staffMembers, totals };
}

export function useTeamTrainingAnalytics(dateRange?: TrainingDateRange) {
  const { user } = useAuth();

  // Fetch raw data once (stable queryKey — no dateRange dependency)
  const rawQuery = useQuery<RawTrainingData>({
    queryKey: ['team-training-analytics-raw', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      // 1. Get agency_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('agency_id')
        .eq('id', user!.id)
        .single();

      if (!profile?.agency_id) throw new Error('No agency found');
      const agencyId = profile.agency_id;

      // 2. Get active staff users
      const { data: staffUsers } = await supabase
        .from('staff_users')
        .select('id, display_name, email, is_active, last_login_at')
        .eq('agency_id', agencyId)
        .eq('is_active', true)
        .order('display_name');

      if (!staffUsers || staffUsers.length === 0) {
        return {
          staffUsers: [], spProgress: [], spLessons: [],
          agencyProgress: [], agencyAssignments: [], agencyLessons: [],
          challengeAssignments: [], challengeProgress: [],
          salesExpAssignments: [], salesExpProgress: [],
        };
      }

      const staffIds = staffUsers.map((s) => s.id);

      // 3. Fetch all data sources in parallel
      const [
        spProgressRes, spLessonsRes,
        agencyProgressRes, agencyAssignmentsRes, agencyLessonsRes,
        challengeAssignmentsRes, challengeProgressRes,
        salesExpAssignmentsRes, salesExpProgressRes,
      ] = await Promise.all([
        supabase
          .from('sp_progress_staff')
          .select('id, staff_user_id, lesson_id, video_watched, video_watched_seconds, content_viewed, quiz_completed, quiz_passed, quiz_score, started_at, completed_at')
          .in('staff_user_id', staffIds),
        supabase
          .from('sp_lessons')
          .select('id, estimated_minutes, name, module_id')
          .eq('is_published', true),
        // Read from staff_lesson_progress (where update_staff_training_progress writes)
        // NOT training_lesson_progress (which nothing writes to)
        supabase
          .from('staff_lesson_progress')
          .select('id, staff_user_id, lesson_id, completed, completed_at, created_at')
          .in('staff_user_id', staffIds),
        supabase
          .from('training_assignments')
          .select('id, staff_user_id, module_id, lesson_id, due_date, seen_at, assigned_at')
          .eq('agency_id', agencyId)
          .in('staff_user_id', staffIds),
        supabase
          .from('training_lessons')
          .select('id, estimated_duration_minutes, name, module_id')
          .eq('agency_id', agencyId)
          .eq('is_active', true),
        supabase
          .from('challenge_assignments')
          .select('id, staff_user_id, status, start_date, end_date')
          .eq('agency_id', agencyId)
          .in('staff_user_id', staffIds),
        supabase
          .from('challenge_progress')
          .select('id, staff_user_id, assignment_id, status, video_watched_seconds, video_completed, completed_at, reflection_response, started_at')
          .in('staff_user_id', staffIds),
        supabase
          .from('sales_experience_assignments')
          .select('id, status, start_date, end_date')
          .eq('agency_id', agencyId),
        supabase
          .from('sales_experience_staff_progress')
          .select('id, staff_user_id, assignment_id, lesson_id, status, video_watched_seconds, video_completed, started_at, completed_at')
          .in('staff_user_id', staffIds),
      ]);

      return {
        staffUsers,
        spProgress: spProgressRes.data || [],
        spLessons: (spLessonsRes.data || []) as StandardPlaybookLessonRow[],
        agencyProgress: agencyProgressRes.data || [],
        agencyAssignments: agencyAssignmentsRes.data || [],
        agencyLessons: (agencyLessonsRes.data || []) as AgencyTrainingLessonRow[],
        challengeAssignments: challengeAssignmentsRes.data || [],
        challengeProgress: challengeProgressRes.data || [],
        salesExpAssignments: salesExpAssignmentsRes.data || [],
        salesExpProgress: salesExpProgressRes.data || [],
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  // Compute analytics from cached raw data — instant when switching date ranges.
  // Use primitive timestamps as deps so object identity changes don't trigger recomputation.
  const fromMs = dateRange?.from?.getTime() ?? null;
  const toMs = dateRange?.to?.getTime() ?? null;
  const data = useMemo(() => {
    if (!rawQuery.data) return undefined;
    const range: TrainingDateRange = fromMs != null && toMs != null
      ? { from: new Date(fromMs), to: new Date(toMs) }
      : null;
    return computeAnalytics(rawQuery.data, range);
  }, [rawQuery.data, fromMs, toMs]);

  return { data, isLoading: rawQuery.isLoading, error: rawQuery.error };
}

function emptyTotals(): TrainingAnalyticsTotals {
  return {
    totalStaff: 0,
    activeThisWeek: 0,
    spLessonsCompleted: 0,
    spLessonsStarted: 0,
    agencyLessonsCompleted: 0,
    agencyLessonsStarted: 0,
    challengeLessonsCompleted: 0,
    salesExpLessonsCompleted: 0,
    totalVideoSeconds: 0,
    totalEstimatedMinutes: 0,
    spTotalAvailable: 0,
    agencyTotalAvailable: 0,
  };
}
