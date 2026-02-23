import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { session_token, agency_id } = await req.json();

    if (!session_token || !agency_id) {
      return new Response(
        JSON.stringify({ error: 'Session token and agency_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify session
    const { data: session, error: sessionError } = await supabase
      .from('staff_sessions')
      .select('*, staff_users!inner(*)')
      .eq('session_token', session_token)
      .eq('is_valid', true)
      .gt('expires_at', new Date().toISOString())
      .single() as { data: any; error: any };

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify staff belongs to requested agency
    if (session.staff_users.agency_id !== agency_id) {
      return new Response(
        JSON.stringify({ error: 'Access denied to this agency' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const staffEmail = session.staff_users.email;

    // Check if this staff user is an agency owner/admin by matching their email to profiles
    const { data: ownerProfile } = await supabase
      .from('profiles')
      .select('id, agency_id, role')
      .eq('email', staffEmail)
      .single();

    // Check if they're an admin via user_roles table
    let isAdmin = false;
    if (ownerProfile?.id) {
      const { data: adminRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', ownerProfile.id)
        .eq('role', 'admin')
        .maybeSingle();
      
      isAdmin = !!adminRole;
    }

    // Check if staff user is a Manager - they should see all content like admins
    const isManager = session.staff_users.role === 'Manager';
    
    // User is an agency owner if their profile owns this agency, they're a system admin, or they're a Manager
    const isAgencyOwnerOrAdmin = isAdmin || isManager || (ownerProfile?.agency_id === agency_id);

    console.log(`Staff ${staffEmail}: isAgencyOwnerOrAdmin=${isAgencyOwnerOrAdmin}, isAdmin=${isAdmin}, isManager=${isManager}`);

    let modulesWithDueDates: any[] = [];
    let noAssignments = false;

    if (isAgencyOwnerOrAdmin) {
      // ADMIN BYPASS: Fetch ALL active modules for this agency (no assignment check)
      const { data: allModules, error: modulesError } = await supabase
        .from('training_modules')
        .select('*')
        .eq('agency_id', agency_id)
        .eq('is_active', true)
        .order('sort_order');

      if (modulesError) {
        console.error('Error fetching modules for admin:', modulesError);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch modules' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // For admins, no due_date constraint - they see everything
      modulesWithDueDates = (allModules || []).map(m => ({ ...m, due_date: null }));
      noAssignments = false; // Admins always see content if it exists
      
      console.log(`Admin view: Found ${modulesWithDueDates.length} modules for agency ${agency_id}`);
    } else {
      // REGULAR STAFF: Check multi-level assignments
      const { data: assignments, error: assignmentsError } = await supabase
        .from('training_assignments')
        .select('category_id, module_id, lesson_id, due_date')
        .eq('staff_user_id', session.staff_users.id)
        .eq('agency_id', agency_id);

      if (assignmentsError) {
        console.error('Error fetching assignments:', assignmentsError);
      }

      // If no assignments exist, return empty with flag
      if (!assignments || assignments.length === 0) {
        return new Response(
          JSON.stringify({
            modules: [],
            categories: [],
            lessons: [],
            attachments: [],
            quizzes: [],
            quiz_questions: [],
            quiz_options: [],
            no_assignments: true,
            staff_user: {
              id: session.staff_users.id,
              username: session.staff_users.username,
              display_name: session.staff_users.display_name
            }
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Resolve multi-level assignments to module IDs
      const categoryAssignments = assignments.filter(a => a.category_id);
      const moduleAssignments = assignments.filter(a => a.module_id);
      const lessonAssignments = assignments.filter(a => a.lesson_id);

      const accessibleModuleIds = new Set<string>();
      const moduleDueDates = new Map<string, string | null>();

      // Category assignments → all modules in those categories
      if (categoryAssignments.length > 0) {
        const catIds = categoryAssignments.map(a => a.category_id!);
        const { data: catModules } = await supabase
          .from('training_modules')
          .select('id, category_id')
          .in('category_id', catIds)
          .eq('is_active', true);

        (catModules || []).forEach((m: any) => {
          accessibleModuleIds.add(m.id);
          const catAssignment = categoryAssignments.find(a => a.category_id === m.category_id);
          if (catAssignment?.due_date && !moduleDueDates.has(m.id)) {
            moduleDueDates.set(m.id, catAssignment.due_date);
          }
        });
      }

      // Module assignments → those specific modules
      for (const a of moduleAssignments) {
        if (a.module_id) {
          accessibleModuleIds.add(a.module_id);
          moduleDueDates.set(a.module_id, a.due_date);
        }
      }

      // Lesson assignments → parent modules (we'll filter lessons on the frontend)
      if (lessonAssignments.length > 0) {
        const lessonIds = lessonAssignments.map(a => a.lesson_id!);
        const { data: lessonRows } = await supabase
          .from('training_lessons')
          .select('id, module_id')
          .in('id', lessonIds);

        (lessonRows || []).forEach((l: any) => {
          accessibleModuleIds.add(l.module_id);
          const lessonAssignment = lessonAssignments.find(a => a.lesson_id === l.id);
          if (lessonAssignment?.due_date && !moduleDueDates.has(l.module_id)) {
            moduleDueDates.set(l.module_id, lessonAssignment.due_date);
          }
        });
      }

      if (accessibleModuleIds.size === 0) {
        return new Response(
          JSON.stringify({
            modules: [],
            categories: [],
            lessons: [],
            attachments: [],
            quizzes: [],
            quiz_questions: [],
            quiz_options: [],
            no_assignments: true,
            staff_user: {
              id: session.staff_users.id,
              username: session.staff_users.username,
              display_name: session.staff_users.display_name
            }
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch only accessible modules
      const { data: modules, error: modulesError } = await supabase
        .from('training_modules')
        .select('*')
        .in('id', Array.from(accessibleModuleIds))
        .eq('is_active', true)
        .order('sort_order');

      if (modulesError) {
        console.error('Error fetching modules:', modulesError);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch modules' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Attach due_date to each module
      modulesWithDueDates = (modules || []).map(m => ({
        ...m,
        due_date: moduleDueDates.get(m.id) || null
      }));
    }

    // Fetch categories
    const { data: categories, error: categoriesError } = await supabase
      .from('training_categories')
      .select('*')
      .eq('agency_id', agency_id)
      .eq('is_active', true)
      .order('sort_order');

    if (categoriesError) {
      console.error('Error fetching categories:', categoriesError);
    }

    // Fetch lessons for all modules
    const { data: lessons, error: lessonsError } = await supabase
      .from('training_lessons')
      .select('*')
      .eq('agency_id', agency_id)
      .eq('is_active', true)
      .order('sort_order');

    if (lessonsError) {
      console.error('Error fetching lessons:', lessonsError);
    }

    // Fetch attachments
    const { data: attachments, error: attachmentsError } = await supabase
      .from('training_attachments')
      .select('*')
      .eq('agency_id', agency_id)
      .order('created_at');

    if (attachmentsError) {
      console.error('Error fetching attachments:', attachmentsError);
    }

    // Fetch quizzes
    const { data: quizzes, error: quizzesError } = await supabase
      .from('training_quizzes')
      .select('*')
      .eq('agency_id', agency_id)
      .order('created_at');

    if (quizzesError) {
      console.error('Error fetching quizzes:', quizzesError);
    }

    // Fetch quiz questions
    const quizIds = (quizzes || []).map((q: any) => q.id);
    let questions: any[] = [];
    let options: any[] = [];

    if (quizIds.length > 0) {
      const { data: questionsData } = await supabase
        .from('training_quiz_questions')
        .select('*')
        .in('quiz_id', quizIds)
        .order('sort_order');
      questions = questionsData || [];
      
      const questionIds = questions.map((q: any) => q.id);
      if (questionIds.length > 0) {
        const { data: optionsData } = await supabase
          .from('training_quiz_options')
          .select('*')
          .in('question_id', questionIds)
          .order('sort_order');
        options = optionsData || [];
      }
    }

    return new Response(
      JSON.stringify({
        modules: modulesWithDueDates,
        categories: categories || [],
        lessons: lessons || [],
        attachments: attachments || [],
        quizzes: quizzes || [],
        quiz_questions: questions,
        quiz_options: options,
        no_assignments: noAssignments,
        staff_user: {
          id: session.staff_users.id,
          username: session.staff_users.username,
          display_name: session.staff_users.display_name
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get_staff_training_content:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
