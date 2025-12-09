import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { session_token } = await req.json();

    if (!session_token) {
      return new Response(
        JSON.stringify({ success: false, error: 'Session token required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create service role client to bypass RLS
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify session and get staff user
    const { data: session, error: sessionError } = await supabase
      .from('staff_sessions')
      .select('staff_user_id, expires_at, is_valid')
      .eq('session_token', session_token)
      .single();

    if (sessionError || !session) {
      console.error('Session lookup error:', sessionError);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!session.is_valid || new Date(session.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ success: false, error: 'Session expired' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get staff user details
    const { data: staffUser, error: userError } = await supabase
      .from('staff_users')
      .select('id, agency_id')
      .eq('id', session.staff_user_id)
      .single();

    if (userError || !staffUser) {
      console.error('Staff user lookup error:', userError);
      return new Response(
        JSON.stringify({ success: false, error: 'Staff user not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== STANDARD PLAYBOOK STATS ==========
    // Fetch SP categories with modules and lessons
    const { data: spCategories, error: spCatError } = await supabase
      .from('sp_categories')
      .select(`
        id,
        sp_modules(
          id,
          sp_lessons(id)
        )
      `)
      .eq('is_published', true)
      .contains('access_tiers', ['staff']);

    if (spCatError) {
      console.error('SP categories error:', spCatError);
    }

    // Fetch SP progress for this staff user
    const { data: spProgress, error: spProgressError } = await supabase
      .from('sp_progress_staff')
      .select('lesson_id')
      .eq('staff_user_id', staffUser.id)
      .eq('quiz_passed', true);

    if (spProgressError) {
      console.error('SP progress error:', spProgressError);
    }

    const completedSpLessonIds = new Set(spProgress?.map(p => p.lesson_id) || []);
    let spTotalLessons = 0;
    let spCompletedLessons = 0;

    spCategories?.forEach((cat: any) => {
      cat.sp_modules?.forEach((mod: any) => {
        mod.sp_lessons?.forEach((lesson: any) => {
          spTotalLessons++;
          if (completedSpLessonIds.has(lesson.id)) {
            spCompletedLessons++;
          }
        });
      });
    });

    const spStats = {
      categoryCount: spCategories?.length || 0,
      completedLessons: spCompletedLessons,
      totalLessons: spTotalLessons,
    };

    // ========== AGENCY TRAINING STATS ==========
    let agencyStats = {
      moduleCount: 0,
      completedLessons: 0,
      totalLessons: 0,
    };
    let agencyInfo = null;

    if (staffUser.agency_id) {
      // Get agency info
      const { data: agency, error: agencyError } = await supabase
        .from('agencies')
        .select('id, name, logo_url')
        .eq('id', staffUser.agency_id)
        .single();

      if (agencyError) {
        console.error('Agency lookup error:', agencyError);
      } else if (agency) {
        agencyInfo = agency;
      }

      // Get training assignments for this staff user
      const { data: assignments, error: assignError } = await supabase
        .from('training_assignments')
        .select('id, module_id')
        .eq('staff_user_id', staffUser.id);

      if (assignError) {
        console.error('Assignments error:', assignError);
      }

      const moduleIds = assignments?.map(a => a.module_id).filter(Boolean) || [];
      agencyStats.moduleCount = moduleIds.length;

      if (moduleIds.length > 0) {
        // Fetch modules with their lessons
        const { data: modules, error: modulesError } = await supabase
          .from('training_modules')
          .select('id, training_lessons(id)')
          .in('id', moduleIds);

        if (modulesError) {
          console.error('Modules error:', modulesError);
        }

        // Fetch lesson progress
        const { data: lessonProgress, error: progressError } = await supabase
          .from('training_lesson_progress')
          .select('lesson_id')
          .eq('staff_user_id', staffUser.id)
          .eq('completed', true);

        if (progressError) {
          console.error('Lesson progress error:', progressError);
        }

        const completedAgencyLessons = new Set(lessonProgress?.map(p => p.lesson_id) || []);

        modules?.forEach((mod: any) => {
          mod.training_lessons?.forEach((lesson: any) => {
            agencyStats.totalLessons++;
            if (completedAgencyLessons.has(lesson.id)) {
              agencyStats.completedLessons++;
            }
          });
        });
      }
    }

    console.log('Staff training hub stats:', { spStats, agencyStats, agencyInfo });

    return new Response(
      JSON.stringify({
        success: true,
        sp_stats: spStats,
        agency_stats: agencyStats,
        agency_info: agencyInfo,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get_staff_training_hub_stats:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
