import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, handleOptions } from "../_shared/cors.ts";
import { verifyRequest, isVerifyError } from "../_shared/verifyRequest.ts";

Deno.serve(async (req) => {
  const optRes = handleOptions(req);
  if (optRes) return optRes;

  const authResult = await verifyRequest(req);
  if (isVerifyError(authResult)) {
    return new Response(JSON.stringify({ error: authResult.error }), {
      status: authResult.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Only owners/KEs should access team analytics (not staff)
  if (authResult.mode === "staff" && !authResult.isManager) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { agencyId } = authResult;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceRoleKey);

  try {
    // 1. Get all active staff users for this agency
    const { data: staffUsers, error: staffErr } = await admin
      .from("staff_users")
      .select("id, display_name, email, is_active, last_login_at, team_member_id")
      .eq("agency_id", agencyId)
      .eq("is_active", true)
      .order("display_name");

    if (staffErr) throw staffErr;
    if (!staffUsers || staffUsers.length === 0) {
      return new Response(
        JSON.stringify({ staffMembers: [], totals: emptyTotals() }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const staffIds = staffUsers.map((s) => s.id);

    // 2. Fetch all data sources in parallel
    const [
      spProgressRes,
      spLessonsRes,
      agencyProgressRes,
      agencyAssignmentsRes,
      agencyLessonsRes,
      challengeAssignmentsRes,
      challengeProgressRes,
    ] = await Promise.all([
      // Standard Playbook: staff progress (self-directed + any)
      admin
        .from("sp_progress_staff")
        .select("id, staff_user_id, lesson_id, video_watched, content_viewed, quiz_completed, quiz_passed, quiz_score, started_at, completed_at")
        .in("staff_user_id", staffIds),

      // SP lesson metadata for time estimates
      admin
        .from("sp_lessons")
        .select("id, estimated_minutes, name, module_id")
        .eq("is_published", true),

      // Agency Training: lesson progress
      admin
        .from("training_lesson_progress")
        .select("id, staff_user_id, lesson_id, is_completed, started_at, completed_at")
        .eq("agency_id", agencyId)
        .in("staff_user_id", staffIds),

      // Agency Training: assignments
      admin
        .from("training_assignments")
        .select("id, staff_user_id, module_id, lesson_id, due_date, seen_at, assigned_at")
        .eq("agency_id", agencyId)
        .in("staff_user_id", staffIds),

      // Agency Training: lesson metadata for time estimates
      admin
        .from("training_lessons")
        .select("id, estimated_duration_minutes, name, module_id")
        .eq("agency_id", agencyId)
        .eq("is_active", true),

      // Challenge: assignments for this agency
      admin
        .from("challenge_assignments")
        .select("id, staff_user_id, status, start_date, end_date")
        .eq("agency_id", agencyId)
        .in("staff_user_id", staffIds),

      // Challenge: progress for this agency's staff
      admin
        .from("challenge_progress")
        .select("id, staff_user_id, assignment_id, status, video_watched_seconds, video_completed, completed_at, reflection_response, started_at")
        .in("staff_user_id", staffIds),
    ]);

    const spProgress = spProgressRes.data || [];
    const spLessons = spLessonsRes.data || [];
    const agencyProgress = agencyProgressRes.data || [];
    const agencyAssignments = agencyAssignmentsRes.data || [];
    const agencyLessons = agencyLessonsRes.data || [];
    const challengeAssignments = challengeAssignmentsRes.data || [];
    const challengeProgress = challengeProgressRes.data || [];

    // Build lookup maps
    const spLessonMap = new Map(spLessons.map((l) => [l.id, l]));
    const agencyLessonMap = new Map(agencyLessons.map((l) => [l.id, l]));

    // Calculate 7 days ago for "active this week"
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString();

    let totalActiveThisWeek = 0;

    // 3. Build per-staff analytics
    const staffMembers = staffUsers.map((staff) => {
      // --- Standard Playbook ---
      const staffSp = spProgress.filter((p) => p.staff_user_id === staff.id);
      const spStarted = staffSp.filter((p) => p.started_at).length;
      const spCompleted = staffSp.filter((p) => p.quiz_passed === true).length;
      const spVideosWatched = staffSp.filter((p) => p.video_watched === true).length;
      const spQuizzesPassed = staffSp.filter((p) => p.quiz_passed === true).length;
      const spLastActivity = staffSp
        .map((p) => p.completed_at || p.started_at)
        .filter(Boolean)
        .sort()
        .reverse()[0] || null;
      const spTimeMinutes = staffSp
        .filter((p) => p.quiz_passed === true)
        .reduce((sum, p) => {
          const lesson = spLessonMap.get(p.lesson_id);
          return sum + (lesson?.estimated_minutes || 0);
        }, 0);

      // --- Agency Training ---
      const staffAgency = agencyProgress.filter((p) => p.staff_user_id === staff.id);
      const staffAssignments = agencyAssignments.filter((a) => a.staff_user_id === staff.id);
      const agencyStarted = staffAgency.filter((p) => p.started_at).length;
      const agencyCompleted = staffAgency.filter((p) => p.is_completed === true).length;
      const assignmentsTotal = staffAssignments.length;
      // Count assignments where the lesson is completed
      const assignedLessonIds = new Set(staffAssignments.map((a) => a.lesson_id).filter(Boolean));
      const assignmentsCompleted = staffAgency.filter(
        (p) => p.is_completed === true && assignedLessonIds.has(p.lesson_id)
      ).length;
      const agencyLastActivity = staffAgency
        .map((p) => p.completed_at || p.started_at)
        .filter(Boolean)
        .sort()
        .reverse()[0] || null;
      const agencyTimeMinutes = staffAgency
        .filter((p) => p.is_completed === true)
        .reduce((sum, p) => {
          const lesson = agencyLessonMap.get(p.lesson_id);
          return sum + (lesson?.estimated_duration_minutes || 0);
        }, 0);

      // --- Challenge ---
      const staffChallengeAssignments = challengeAssignments.filter(
        (a) => a.staff_user_id === staff.id
      );
      const enrolled = staffChallengeAssignments.length > 0;
      const assignmentIds = new Set(staffChallengeAssignments.map((a) => a.id));
      const staffChallenge = challengeProgress.filter(
        (p) => p.staff_user_id === staff.id && assignmentIds.has(p.assignment_id)
      );
      const challengeCompleted = staffChallenge.filter((p) => p.status === "completed").length;
      const challengeTotal = staffChallenge.length || (enrolled ? 30 : 0);
      const videoWatchedSeconds = staffChallenge.reduce(
        (sum, p) => sum + (p.video_watched_seconds || 0),
        0
      );
      const reflectionsSubmitted = staffChallenge.filter(
        (p) => p.reflection_response && Object.keys(p.reflection_response as Record<string, unknown>).length > 0
      ).length;
      const challengeLastActivity = staffChallenge
        .map((p) => p.completed_at || p.started_at)
        .filter(Boolean)
        .sort()
        .reverse()[0] || null;

      // Determine latest activity across all systems
      const allActivities = [spLastActivity, agencyLastActivity, challengeLastActivity].filter(Boolean) as string[];
      const lastActivityOverall = allActivities.sort().reverse()[0] || null;
      const isActiveThisWeek = lastActivityOverall && lastActivityOverall >= sevenDaysAgoStr;

      if (isActiveThisWeek) totalActiveThisWeek++;

      // Total estimated time (minutes): SP completed + Agency completed + Challenge video time
      const totalTimeMinutes = spTimeMinutes + agencyTimeMinutes + Math.round(videoWatchedSeconds / 60);

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
          videoWatchedSeconds,
          reflectionsSubmitted,
          lastActivity: challengeLastActivity,
        },
        totalTimeMinutes,
      };
    });

    // 4. Compute totals
    const totals = {
      totalStaff: staffUsers.length,
      activeThisWeek: totalActiveThisWeek,
      spLessonsCompleted: staffMembers.reduce((s, m) => s + m.standardPlaybook.lessonsCompleted, 0),
      spLessonsStarted: staffMembers.reduce((s, m) => s + m.standardPlaybook.lessonsStarted, 0),
      agencyLessonsCompleted: staffMembers.reduce((s, m) => s + m.agencyTraining.lessonsCompleted, 0),
      agencyLessonsStarted: staffMembers.reduce((s, m) => s + m.agencyTraining.lessonsStarted, 0),
      challengeLessonsCompleted: staffMembers.reduce((s, m) => s + m.challenge.lessonsCompleted, 0),
      totalVideoSeconds: staffMembers.reduce((s, m) => s + m.challenge.videoWatchedSeconds, 0),
      totalEstimatedMinutes: staffMembers.reduce((s, m) => s + m.totalTimeMinutes, 0),
      spTotalAvailable: spLessons.length,
      agencyTotalAvailable: agencyLessons.length,
    };

    return new Response(JSON.stringify({ staffMembers, totals }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error in get-team-training-analytics:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function emptyTotals() {
  return {
    totalStaff: 0,
    activeThisWeek: 0,
    spLessonsCompleted: 0,
    spLessonsStarted: 0,
    agencyLessonsCompleted: 0,
    agencyLessonsStarted: 0,
    challengeLessonsCompleted: 0,
    totalVideoSeconds: 0,
    totalEstimatedMinutes: 0,
    spTotalAvailable: 0,
    agencyTotalAvailable: 0,
  };
}
