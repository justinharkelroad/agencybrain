import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/auth';

export interface QuizQuestionDetail {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  selectedIndex: number | null;
  isCorrect: boolean;
}

export interface SPLessonDetail {
  id: string;
  lessonName: string;
  moduleName: string;
  categoryName: string;
  videoWatched: boolean;
  videoWatchedSeconds: number;
  quizPassed: boolean;
  quizScore: number | null;
  startedAt: string | null;
  completedAt: string | null;
  quizQuestions: QuizQuestionDetail[];
  reflectionTakeaway: string | null;
  reflectionAction: string | null;
  reflectionResult: string | null;
  aiSummary: string | null;
}

export interface AgencyLessonDetail {
  id: string;
  lessonName: string;
  moduleName: string;
  categoryName: string;
  completed: boolean;
  completedAt: string | null;
  createdAt: string;
  isAssigned: boolean;
}

export interface ChallengeLessonDetail {
  id: string;
  lessonTitle: string;
  dayNumber: number;
  weekNumber: number | null;
  status: string;
  videoWatchedSeconds: number;
  videoCompleted: boolean;
  completedAt: string | null;
  hasReflection: boolean;
}

export interface SalesExpLessonDetail {
  id: string;
  lessonTitle: string;
  moduleTitle: string;
  weekNumber: number;
  status: string;
  videoWatchedSeconds: number;
  videoCompleted: boolean;
  startedAt: string | null;
  completedAt: string | null;
  quizScorePercent: number | null;
}

export interface StaffTrainingDetail {
  spLessons: SPLessonDetail[];
  agencyLessons: AgencyLessonDetail[];
  challengeLessons: ChallengeLessonDetail[];
  salesExpLessons: SalesExpLessonDetail[];
}

export function useStaffTrainingDetail(staffUserId: string | null) {
  const { user } = useAuth();

  return useQuery<StaffTrainingDetail>({
    queryKey: ['staff-training-detail', staffUserId],
    enabled: !!staffUserId && !!user?.id,
    queryFn: async () => {
      if (!staffUserId) throw new Error('No staff user ID');

      // Get agency_id for scoping agency training queries
      const { data: profile } = await supabase
        .from('profiles')
        .select('agency_id')
        .eq('id', user!.id)
        .single();

      if (!profile?.agency_id) throw new Error('No agency found');
      const agencyId = profile.agency_id;

      // Fetch all systems in parallel
      const [
        spRes,
        agencyRes,
        agencyAssignRes,
        challengeAssignRes,
        challengeRes,
        salesExpAssignRes,
        salesExpRes,
      ] = await Promise.all([
        // SP: progress with nested lesson → module → category, plus quiz questions
        supabase
          .from('sp_progress_staff')
          .select(`
            id,
            video_watched,
            video_watched_seconds,
            quiz_passed,
            quiz_score,
            quiz_answers_json,
            reflection_takeaway,
            reflection_action,
            reflection_result,
            ai_summary,
            started_at,
            completed_at,
            sp_lessons (
              name,
              sp_modules (
                name,
                sp_categories ( name )
              ),
              sp_quizzes ( questions_json )
            )
          `)
          .eq('staff_user_id', staffUserId)
          .order('started_at', { ascending: true, nullsFirst: false }),

        // Agency: progress with nested lesson → module → category
        supabase
          .from('staff_lesson_progress')
          .select(`
            id,
            lesson_id,
            lesson_name,
            module_name,
            completed,
            completed_at,
            created_at,
            training_lessons (
              name,
              training_modules (
                name,
                training_categories ( name )
              )
            )
          `)
          .eq('staff_user_id', staffUserId),

        // Agency assignments for this staff member
        supabase
          .from('training_assignments')
          .select('lesson_id')
          .eq('agency_id', agencyId)
          .eq('staff_user_id', staffUserId),

        // Challenge assignments for this agency + staff member (scope by assignment)
        supabase
          .from('challenge_assignments')
          .select('id')
          .eq('agency_id', agencyId)
          .eq('staff_user_id', staffUserId),

        // Challenge: progress with nested lesson info
        supabase
          .from('challenge_progress')
          .select(`
            id,
            assignment_id,
            status,
            video_watched_seconds,
            video_completed,
            completed_at,
            reflection_response,
            challenge_lessons (
              title,
              day_number,
              week_number
            )
          `)
          .eq('staff_user_id', staffUserId)
          .order('created_at', { ascending: true }),

        // Sales Experience assignments for this agency (agency-level, no staff_user_id column)
        supabase
          .from('sales_experience_assignments')
          .select('id')
          .eq('agency_id', agencyId),

        // Sales Experience: progress with nested lesson → module
        supabase
          .from('sales_experience_staff_progress')
          .select(`
            id,
            assignment_id,
            status,
            video_watched_seconds,
            video_completed,
            started_at,
            completed_at,
            quiz_score_percent,
            sales_experience_lessons (
              title,
              sales_experience_modules (
                title,
                week_number
              )
            )
          `)
          .eq('staff_user_id', staffUserId)
          .order('created_at', { ascending: true }),
      ]);

      // Build assignment ID sets for scoping challenge + sales exp
      const challengeAssignmentIds = new Set(
        (challengeAssignRes.data || []).map((a) => a.id)
      );
      const salesExpAssignmentIds = new Set(
        (salesExpAssignRes.data || []).map((a) => a.id)
      );

      // Build assigned lesson IDs set
      const assignedLessonIds = new Set(
        (agencyAssignRes.data || []).map((a) => a.lesson_id).filter(Boolean)
      );

      // Transform SP lessons
      // Note: video_watched_seconds exists in DB (migration 20260310190000) but not
      // in generated types yet. Access via any cast — column returns 0 for old rows.
      const spLessons: SPLessonDetail[] = (spRes.data || []).map((row: any) => {
        // Parse quiz Q&A: match student answers against quiz questions
        const quizQuestions: QuizQuestionDetail[] = [];
        const answersMap = row.quiz_answers_json as Record<string, number> | null;
        // sp_quizzes is 1:1 with sp_lessons, so PostgREST returns an object (not array)
        const quizData = row.sp_lessons?.sp_quizzes;
        const questionsJson = quizData?.questions_json as Array<{
          id: string; question: string; options: string[]; correct_index: number;
        }> | null;

        if (questionsJson) {
          for (const q of questionsJson) {
            const selected = answersMap?.[q.id] ?? null;
            quizQuestions.push({
              id: q.id,
              question: q.question,
              options: q.options,
              correctIndex: q.correct_index,
              selectedIndex: selected,
              isCorrect: selected != null && selected === q.correct_index,
            });
          }
        }

        return {
          id: row.id,
          lessonName: row.sp_lessons?.name || 'Unknown Lesson',
          moduleName: row.sp_lessons?.sp_modules?.name || '',
          categoryName: row.sp_lessons?.sp_modules?.sp_categories?.name || '',
          videoWatched: row.video_watched === true,
          videoWatchedSeconds: row.video_watched_seconds || 0,
          quizPassed: row.quiz_passed === true,
          quizScore: row.quiz_score,
          startedAt: row.started_at,
          completedAt: row.completed_at,
          quizQuestions,
          reflectionTakeaway: row.reflection_takeaway || null,
          reflectionAction: row.reflection_action || null,
          reflectionResult: row.reflection_result || null,
          aiSummary: row.ai_summary || null,
        };
      });

      // Sort SP: completed first (by completedAt), then started (by startedAt)
      spLessons.sort((a, b) => {
        if (a.quizPassed && !b.quizPassed) return -1;
        if (!a.quizPassed && b.quizPassed) return 1;
        const aDate = a.completedAt || a.startedAt || '';
        const bDate = b.completedAt || b.startedAt || '';
        return bDate.localeCompare(aDate);
      });

      // Transform Agency lessons
      const agencyLessons: AgencyLessonDetail[] = (agencyRes.data || []).map((row: any) => {
        const lessonFromJoin = row.training_lessons;
        const moduleName = lessonFromJoin?.training_modules?.name || row.module_name || '';
        const categoryName = lessonFromJoin?.training_modules?.training_categories?.name || '';
        const lessonName = lessonFromJoin?.name || row.lesson_name || 'Unknown Lesson';

        return {
          id: row.id,
          lessonName,
          moduleName,
          categoryName,
          completed: row.completed === true,
          completedAt: row.completed_at,
          createdAt: row.created_at,
          isAssigned: row.lesson_id ? assignedLessonIds.has(row.lesson_id) : false,
        };
      });

      // Sort agency: completed first, then by date
      agencyLessons.sort((a, b) => {
        if (a.completed && !b.completed) return -1;
        if (!a.completed && b.completed) return 1;
        const aDate = a.completedAt || a.createdAt;
        const bDate = b.completedAt || b.createdAt;
        return bDate.localeCompare(aDate);
      });

      // Transform Challenge lessons — scoped to this agency's assignments
      const challengeLessons: ChallengeLessonDetail[] = (challengeRes.data || [])
        .filter((row: any) => challengeAssignmentIds.has(row.assignment_id))
        .map((row: any) => ({
          id: row.id,
          lessonTitle: row.challenge_lessons?.title || 'Unknown Lesson',
          dayNumber: row.challenge_lessons?.day_number || 0,
          weekNumber: row.challenge_lessons?.week_number ?? null,
          status: row.status,
          videoWatchedSeconds: row.video_watched_seconds || 0,
          videoCompleted: row.video_completed === true,
          completedAt: row.completed_at,
          hasReflection:
            !!row.reflection_response &&
            typeof row.reflection_response === 'object' &&
            Object.keys(row.reflection_response).length > 0,
        }));

      // Sort challenge by day number
      challengeLessons.sort((a, b) => a.dayNumber - b.dayNumber);

      // Transform Sales Experience lessons — scoped to this agency's assignments
      const salesExpLessons: SalesExpLessonDetail[] = (salesExpRes.data || [])
        .filter((row: any) => salesExpAssignmentIds.has(row.assignment_id))
        .map((row: any) => ({
          id: row.id,
          lessonTitle: row.sales_experience_lessons?.title || 'Unknown Lesson',
          moduleTitle: row.sales_experience_lessons?.sales_experience_modules?.title || '',
          weekNumber: row.sales_experience_lessons?.sales_experience_modules?.week_number || 0,
          status: row.status,
          videoWatchedSeconds: row.video_watched_seconds || 0,
          videoCompleted: row.video_completed === true,
          startedAt: row.started_at,
          completedAt: row.completed_at,
          quizScorePercent: row.quiz_score_percent,
        }));

      // Sort sales exp by week number, then by lesson order
      salesExpLessons.sort((a, b) => {
        if (a.weekNumber !== b.weekNumber) return a.weekNumber - b.weekNumber;
        return a.lessonTitle.localeCompare(b.lessonTitle);
      });

      return { spLessons, agencyLessons, challengeLessons, salesExpLessons };
    },
    staleTime: 2 * 60 * 1000,
  });
}
