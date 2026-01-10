import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-staff-session',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

interface RequestBody {
  action: string;
  [key: string]: any;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Service role client bypasses RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: RequestBody = await req.json();
    const { action, ...params } = body;

    // Get staff session token from header
    const staffSessionToken = req.headers.get('x-staff-session');
    
    if (!staffSessionToken) {
      return new Response(
        JSON.stringify({ error: 'Staff session token required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify staff session and get user info (same pattern as scorecards_admin)
    const { data: sessionData, error: sessionError } = await supabase
      .from('staff_sessions')
      .select(`
        id,
        staff_user_id,
        expires_at,
        staff_users!inner (
          id,
          agency_id,
          team_member_id,
          team_members!inner (
            role
          )
        )
      `)
      .eq('session_token', staffSessionToken)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (sessionError || !sessionData) {
      console.error('Session validation failed:', sessionError);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const staffUser = sessionData.staff_users as any;
    const agencyId = staffUser.agency_id;
    const teamMemberRole = staffUser.team_members?.role;

    // Only managers can manage training
    if (teamMemberRole !== 'Manager') {
      return new Response(
        JSON.stringify({ error: 'Manager access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[training_admin] Action: ${action}, Agency: ${agencyId}, Role: ${teamMemberRole}`);

    let result: any = null;

    switch (action) {
      // ============ CATEGORIES ============
      case 'categories_list': {
        const { data, error } = await supabase
          .from('training_categories')
          .select('*')
          .eq('agency_id', agencyId)
          .order('sort_order', { ascending: true });
        if (error) throw error;
        result = { categories: data };
        break;
      }

      case 'category_create': {
        const { name, description, sort_order, is_active } = params;
        const { data, error } = await supabase
          .from('training_categories')
          .insert({ agency_id: agencyId, name, description, sort_order, is_active: is_active ?? true })
          .select()
          .single();
        if (error) throw error;
        result = { category: data };
        break;
      }

      case 'category_update': {
        const { id, updates } = params;
        // Verify category belongs to this agency
        const { data: existing } = await supabase
          .from('training_categories')
          .select('agency_id')
          .eq('id', id)
          .single();
        if (existing?.agency_id !== agencyId) {
          throw new Error('Category not found');
        }
        const { data, error } = await supabase
          .from('training_categories')
          .update(updates)
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        result = { category: data };
        break;
      }

      case 'category_delete': {
        const { id } = params;
        const { data: existing } = await supabase
          .from('training_categories')
          .select('agency_id')
          .eq('id', id)
          .single();
        if (existing?.agency_id !== agencyId) {
          throw new Error('Category not found');
        }
        const { error } = await supabase
          .from('training_categories')
          .delete()
          .eq('id', id);
        if (error) throw error;
        result = { success: true };
        break;
      }

      // ============ MODULES ============
      case 'modules_list': {
        const { category_id } = params;
        const { data, error } = await supabase
          .from('training_modules')
          .select('*')
          .eq('category_id', category_id)
          .order('sort_order', { ascending: true });
        if (error) throw error;
        result = { modules: data };
        break;
      }

      case 'module_create': {
        const { category_id, name, description, sort_order, is_active } = params;
        // Verify category belongs to this agency
        const { data: cat } = await supabase
          .from('training_categories')
          .select('agency_id')
          .eq('id', category_id)
          .single();
        if (cat?.agency_id !== agencyId) {
          throw new Error('Category not found');
        }
        const { data, error } = await supabase
          .from('training_modules')
          .insert({ agency_id: agencyId, category_id, name, description, sort_order, is_active: is_active ?? true })
          .select()
          .single();
        if (error) throw error;
        result = { module: data };
        break;
      }

      case 'module_update': {
        const { id, updates } = params;
        const { data: existing } = await supabase
          .from('training_modules')
          .select('agency_id')
          .eq('id', id)
          .single();
        if (existing?.agency_id !== agencyId) {
          throw new Error('Module not found');
        }
        const { data, error } = await supabase
          .from('training_modules')
          .update(updates)
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        result = { module: data };
        break;
      }

      case 'module_delete': {
        const { id } = params;
        const { data: existing } = await supabase
          .from('training_modules')
          .select('agency_id')
          .eq('id', id)
          .single();
        if (existing?.agency_id !== agencyId) {
          throw new Error('Module not found');
        }
        const { error } = await supabase
          .from('training_modules')
          .delete()
          .eq('id', id);
        if (error) throw error;
        result = { success: true };
        break;
      }

      // ============ LESSONS ============
      case 'lessons_list': {
        const { module_id } = params;
        const { data, error } = await supabase
          .from('training_lessons')
          .select('*')
          .eq('module_id', module_id)
          .order('sort_order', { ascending: true });
        if (error) throw error;
        result = { lessons: data };
        break;
      }

      case 'lesson_create': {
        const { module_id, name, description, video_url, video_platform, content_html, thumbnail_url, sort_order, is_active, estimated_duration_minutes } = params;
        // Verify module belongs to this agency
        const { data: mod } = await supabase
          .from('training_modules')
          .select('agency_id')
          .eq('id', module_id)
          .single();
        if (mod?.agency_id !== agencyId) {
          throw new Error('Module not found');
        }
        const { data, error } = await supabase
          .from('training_lessons')
          .insert({ 
            agency_id: agencyId, 
            module_id, 
            name, 
            description, 
            video_url, 
            video_platform,
            content_html,
            thumbnail_url,
            sort_order, 
            is_active: is_active ?? true,
            estimated_duration_minutes
          })
          .select()
          .single();
        if (error) throw error;
        result = { lesson: data };
        break;
      }

      case 'lesson_update': {
        const { id, updates } = params;
        const { data: existing } = await supabase
          .from('training_lessons')
          .select('agency_id')
          .eq('id', id)
          .single();
        if (existing?.agency_id !== agencyId) {
          throw new Error('Lesson not found');
        }
        const { data, error } = await supabase
          .from('training_lessons')
          .update(updates)
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        result = { lesson: data };
        break;
      }

      case 'lesson_delete': {
        const { id } = params;
        const { data: existing } = await supabase
          .from('training_lessons')
          .select('agency_id')
          .eq('id', id)
          .single();
        if (existing?.agency_id !== agencyId) {
          throw new Error('Lesson not found');
        }
        const { error } = await supabase
          .from('training_lessons')
          .delete()
          .eq('id', id);
        if (error) throw error;
        result = { success: true };
        break;
      }

      // ============ ATTACHMENTS ============
      case 'attachments_list': {
        const { lesson_id } = params;
        const { data, error } = await supabase
          .from('training_attachments')
          .select('*')
          .eq('lesson_id', lesson_id)
          .order('sort_order', { ascending: true });
        if (error) throw error;
        result = { attachments: data };
        break;
      }

      case 'attachment_create': {
        const { lesson_id, name, file_type, file_url, file_size_bytes, is_external_link, sort_order } = params;
        // Verify lesson belongs to this agency
        const { data: lesson } = await supabase
          .from('training_lessons')
          .select('agency_id')
          .eq('id', lesson_id)
          .single();
        if (lesson?.agency_id !== agencyId) {
          throw new Error('Lesson not found');
        }
        const { data, error } = await supabase
          .from('training_attachments')
          .insert({ agency_id: agencyId, lesson_id, name, file_type, file_url, file_size_bytes, is_external_link, sort_order })
          .select()
          .single();
        if (error) throw error;
        result = { attachment: data };
        break;
      }

      case 'attachment_delete': {
        const { id, file_url, is_external } = params;
        const { data: existing } = await supabase
          .from('training_attachments')
          .select('agency_id')
          .eq('id', id)
          .single();
        if (existing?.agency_id !== agencyId) {
          throw new Error('Attachment not found');
        }
        // Delete DB record
        const { error: dbError } = await supabase
          .from('training_attachments')
          .delete()
          .eq('id', id);
        if (dbError) throw dbError;
        // Delete from storage if not external
        if (!is_external && file_url) {
          await supabase.storage.from('training-files').remove([file_url]);
        }
        result = { success: true };
        break;
      }

      case 'attachment_get_signed_url': {
        const { file_url } = params;
        const { data, error } = await supabase.storage
          .from('training-files')
          .createSignedUrl(file_url, 3600);
        if (error) throw error;
        result = { signedUrl: data.signedUrl };
        break;
      }

      case 'attachment_get_upload_url': {
        const { lesson_id, file_name, content_type } = params;
        // Verify lesson belongs to this agency
        const { data: lesson } = await supabase
          .from('training_lessons')
          .select('agency_id')
          .eq('id', lesson_id)
          .single();
        if (lesson?.agency_id !== agencyId) {
          throw new Error('Lesson not found');
        }
        const path = `${agencyId}/${lesson_id}/${Date.now()}_${file_name}`;
        const { data, error } = await supabase.storage
          .from('training-files')
          .createSignedUploadUrl(path);
        if (error) throw error;
        result = { uploadUrl: data.signedUrl, path };
        break;
      }

      // ============ QUIZZES ============
      case 'quizzes_list': {
        const { lesson_id } = params;
        // Get quizzes
        const { data: quizzes, error: quizError } = await supabase
          .from('training_quizzes')
          .select('*')
          .eq('lesson_id', lesson_id);
        if (quizError) throw quizError;
        
        if (!quizzes || quizzes.length === 0) {
          result = { quizzes: [] };
          break;
        }

        // Get questions
        const quizIds = quizzes.map(q => q.id);
        const { data: questions, error: qError } = await supabase
          .from('training_quiz_questions')
          .select('*')
          .in('quiz_id', quizIds)
          .order('sort_order', { ascending: true });
        if (qError) throw qError;

        // Get options
        const questionIds = (questions || []).map(q => q.id);
        let options: any[] = [];
        if (questionIds.length > 0) {
          const { data: optionsData, error: oError } = await supabase
            .from('training_quiz_options')
            .select('*')
            .in('question_id', questionIds)
            .order('sort_order', { ascending: true });
          if (oError) throw oError;
          options = optionsData || [];
        }

        // Assemble nested structure
        const quizzesWithQuestions = quizzes.map(quiz => ({
          ...quiz,
          questions: (questions || [])
            .filter(q => q.quiz_id === quiz.id)
            .map(question => ({
              ...question,
              options: options.filter(o => o.question_id === question.id)
            }))
        }));

        result = { quizzes: quizzesWithQuestions };
        break;
      }

      case 'quiz_create': {
        const { lesson_id, name, description, is_active, questions } = params;
        // Verify lesson belongs to this agency
        const { data: lesson } = await supabase
          .from('training_lessons')
          .select('agency_id')
          .eq('id', lesson_id)
          .single();
        if (lesson?.agency_id !== agencyId) {
          throw new Error('Lesson not found');
        }

        // Create quiz
        const { data: quiz, error: quizError } = await supabase
          .from('training_quizzes')
          .insert({ agency_id: agencyId, lesson_id, name, description, is_active: is_active ?? true })
          .select()
          .single();
        if (quizError) throw quizError;

        // Create questions
        if (questions && questions.length > 0) {
          const questionsToInsert = questions.map((q: any) => ({
            quiz_id: quiz.id,
            question_text: q.question_text,
            question_type: q.question_type,
            sort_order: q.sort_order,
          }));
          
          const { data: insertedQuestions, error: questionsError } = await supabase
            .from('training_quiz_questions')
            .insert(questionsToInsert)
            .select();
          if (questionsError) throw questionsError;

          // Create options
          const optionsToInsert = (insertedQuestions || []).flatMap((question: any, qIdx: number) => {
            return (questions[qIdx].options || []).map((opt: any) => ({
              question_id: question.id,
              option_text: opt.option_text,
              is_correct: opt.is_correct,
              sort_order: opt.sort_order,
            }));
          });

          if (optionsToInsert.length > 0) {
            const { error: optionsError } = await supabase
              .from('training_quiz_options')
              .insert(optionsToInsert);
            if (optionsError) throw optionsError;
          }
        }

        result = { quiz };
        break;
      }

      case 'quiz_delete': {
        const { id } = params;
        const { data: existing } = await supabase
          .from('training_quizzes')
          .select('agency_id')
          .eq('id', id)
          .single();
        if (existing?.agency_id !== agencyId) {
          throw new Error('Quiz not found');
        }
        // Cascade delete handles questions and options
        const { error } = await supabase
          .from('training_quizzes')
          .delete()
          .eq('id', id);
        if (error) throw error;
        result = { success: true };
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Training admin error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
