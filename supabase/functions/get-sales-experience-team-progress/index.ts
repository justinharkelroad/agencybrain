import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Missing authorization header' }, 401);
    }

    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ error: 'Invalid or expired session' }, 401);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { assignment_id } = await req.json() as { assignment_id?: string };

    if (!assignment_id) {
      return jsonResponse({ error: 'Missing assignment_id' }, 400);
    }

    // Resolve agency + access role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, agency_id, role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return jsonResponse({ error: 'Profile not found' }, 404);
    }

    const isAdmin = profile.role === 'admin';
    let agencyId: string | null = profile.agency_id || null;
    let hasAccess = isAdmin || !!agencyId;

    // Key employee fallback
    if (!hasAccess) {
      const { data: keyEmployee } = await supabase
        .from('key_employees')
        .select('agency_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (keyEmployee?.agency_id) {
        agencyId = keyEmployee.agency_id;
        hasAccess = true;
      }
    }

    // Manager fallback via linked staff/team_member
    if (!hasAccess && user.email) {
      const { data: staffUser } = await supabase
        .from('staff_users')
        .select('agency_id, team_member_id, is_active')
        .eq('email', user.email)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (staffUser?.team_member_id) {
        const { data: teamMember } = await supabase
          .from('team_members')
          .select('role, agency_id')
          .eq('id', staffUser.team_member_id)
          .maybeSingle();

        if (teamMember?.role === 'Manager' || teamMember?.role === 'Owner') {
          agencyId = staffUser.agency_id || teamMember.agency_id || null;
          hasAccess = !!agencyId;
        }
      }
    }

    if (!hasAccess || !agencyId) {
      return jsonResponse({ error: 'Access denied' }, 403);
    }

    const { data: assignment, error: assignmentError } = await supabase
      .from('sales_experience_assignments')
      .select('id, agency_id')
      .eq('id', assignment_id)
      .single();

    if (assignmentError || !assignment) {
      return jsonResponse({ error: 'Assignment not found' }, 404);
    }

    if (!isAdmin && assignment.agency_id !== agencyId) {
      return jsonResponse({ error: 'Access denied' }, 403);
    }

    const { data: progressRows, error: progressError } = await supabase
      .from('sales_experience_staff_progress')
      .select(`
        staff_user_id,
        status,
        quiz_score_percent,
        completed_at,
        staff_users!inner(
          id,
          display_name,
          email,
          team_members(name)
        )
      `)
      .eq('assignment_id', assignment_id);

    if (progressError) {
      return jsonResponse({ error: 'Failed to fetch team progress' }, 500);
    }

    type StaffAgg = {
      staff_user_id: string;
      staff_users: {
        id: string;
        display_name: string;
        email: string | null;
        team_members: { name: string } | null;
      };
      total_lessons: number;
      completed_lessons: number;
      avg_quiz_score: number | null;
      last_activity: string | null;
      score_sum: number;
      score_count: number;
    };

    const staffMap = new Map<string, StaffAgg>();
    for (const row of progressRows || []) {
      const staffId = row.staff_user_id as string;

      if (!staffMap.has(staffId)) {
        staffMap.set(staffId, {
          staff_user_id: staffId,
          staff_users: row.staff_users as StaffAgg['staff_users'],
          total_lessons: 0,
          completed_lessons: 0,
          avg_quiz_score: null,
          last_activity: null,
          score_sum: 0,
          score_count: 0,
        });
      }

      const staff = staffMap.get(staffId)!;
      staff.total_lessons += 1;

      if (row.status === 'completed') {
        staff.completed_lessons += 1;
      }

      if (typeof row.quiz_score_percent === 'number') {
        staff.score_sum += row.quiz_score_percent;
        staff.score_count += 1;
      }

      if (row.completed_at && (!staff.last_activity || new Date(row.completed_at) > new Date(staff.last_activity))) {
        staff.last_activity = row.completed_at;
      }
    }

    const staffProgress = Array.from(staffMap.values()).map((staff) => ({
      staff_user_id: staff.staff_user_id,
      staff_users: staff.staff_users,
      total_lessons: staff.total_lessons,
      completed_lessons: staff.completed_lessons,
      avg_quiz_score: staff.score_count > 0 ? Math.round(staff.score_sum / staff.score_count) : null,
      last_activity: staff.last_activity,
    }));

    const { data: recentQuizzes, error: quizzesError } = await supabase
      .from('sales_experience_quiz_attempts')
      .select(`
        id,
        staff_user_id,
        lesson_id,
        score_percent,
        completed_at,
        answers_json,
        feedback_ai,
        staff_users(display_name),
        sales_experience_lessons(
          title,
          sales_experience_modules(week_number)
        )
      `)
      .eq('assignment_id', assignment_id)
      .order('completed_at', { ascending: false })
      .limit(10);

    if (quizzesError) {
      return jsonResponse({ error: 'Failed to fetch recent quizzes' }, 500);
    }

    return jsonResponse({
      staff_progress: staffProgress,
      recent_quizzes: recentQuizzes || [],
    });
  } catch (error) {
    console.error('get-sales-experience-team-progress error:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
});

