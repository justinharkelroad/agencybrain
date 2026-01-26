import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-staff-session',
};

interface RequestBody {
  action: 'check_draft' | 'create_session' | 'save_response' | 'delete_session' | 'complete_session';
  templateSlug?: string;
  sessionId?: string;
  questionId?: string;
  value?: string;
  title?: string;
  domain?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const sessionToken = req.headers.get('x-staff-session');
    
    if (!sessionToken) {
      console.log('[manage_staff_flow_session] No session token provided');
      return new Response(
        JSON.stringify({ error: 'No session token provided' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify session
    const { data: session, error: sessionError } = await supabase
      .from('staff_sessions')
      .select('staff_user_id, expires_at')
      .eq('session_token', sessionToken)
      .single();

    if (sessionError || !session) {
      console.log('[manage_staff_flow_session] Invalid session:', sessionError?.message);
      return new Response(
        JSON.stringify({ error: 'Invalid session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (new Date(session.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'Session expired' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const staffUserId = session.staff_user_id;
    const body: RequestBody = await req.json();
    const { action } = body;

    console.log('[manage_staff_flow_session] Action:', action, 'Staff:', staffUserId);

    switch (action) {
      case 'check_draft': {
        const { templateSlug } = body;
        if (!templateSlug) {
          return new Response(
            JSON.stringify({ error: 'Template slug required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get template
        const { data: template, error: templateError } = await supabase
          .from('flow_templates')
          .select('id, name')
          .eq('slug', templateSlug)
          .eq('is_active', true)
          .single();

        if (templateError || !template) {
          return new Response(
            JSON.stringify({ error: 'Template not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check for existing in-progress session
        const { data: existingSession } = await supabase
          .from('staff_flow_sessions')
          .select('*')
          .eq('staff_user_id', staffUserId)
          .eq('flow_template_id', template.id)
          .eq('status', 'in_progress')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingSession) {
          const answeredCount = Object.keys(existingSession.responses_json || {}).length;
          
          if (answeredCount === 0) {
            // Empty phantom draft - delete it
            console.log('[manage_staff_flow_session] Deleting empty phantom draft:', existingSession.id);
            await supabase.from('staff_flow_sessions').delete().eq('id', existingSession.id);
            return new Response(
              JSON.stringify({ 
                hasDraft: false, 
                template,
                shouldNavigate: true 
              }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          return new Response(
            JSON.stringify({ 
              hasDraft: true, 
              draft: existingSession,
              template,
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ 
            hasDraft: false, 
            template,
            shouldNavigate: true 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'create_session': {
        const { templateSlug } = body;
        if (!templateSlug) {
          return new Response(
            JSON.stringify({ error: 'Template slug required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get template
        const { data: template, error: templateError } = await supabase
          .from('flow_templates')
          .select('*')
          .eq('slug', templateSlug)
          .eq('is_active', true)
          .single();

        if (templateError || !template) {
          return new Response(
            JSON.stringify({ error: 'Template not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check for existing session first
        const { data: existing } = await supabase
          .from('staff_flow_sessions')
          .select('*')
          .eq('staff_user_id', staffUserId)
          .eq('flow_template_id', template.id)
          .eq('status', 'in_progress')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existing) {
          console.log('[manage_staff_flow_session] Reusing existing session:', existing.id);
          return new Response(
            JSON.stringify({ session: existing, template }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Create new session
        const { data: newSession, error: createError } = await supabase
          .from('staff_flow_sessions')
          .insert({
            staff_user_id: staffUserId,
            flow_template_id: template.id,
            status: 'in_progress',
            responses_json: {},
          })
          .select()
          .single();

        if (createError) {
          console.error('[manage_staff_flow_session] Error creating session:', createError);
          return new Response(
            JSON.stringify({ error: 'Failed to create session' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('[manage_staff_flow_session] Created new session:', newSession.id);
        return new Response(
          JSON.stringify({ session: newSession, template }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'save_response': {
        const { sessionId, questionId, value, title, domain } = body;
        if (!sessionId || !questionId) {
          return new Response(
            JSON.stringify({ error: 'Session ID and question ID required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get current session
        const { data: currentSession, error: fetchError } = await supabase
          .from('staff_flow_sessions')
          .select('responses_json')
          .eq('id', sessionId)
          .eq('staff_user_id', staffUserId)
          .single();

        if (fetchError || !currentSession) {
          return new Response(
            JSON.stringify({ error: 'Session not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const newResponses = {
          ...(currentSession.responses_json as Record<string, string> || {}),
          [questionId]: value,
        };

        const updateData: Record<string, unknown> = {
          responses_json: newResponses,
          updated_at: new Date().toISOString(),
        };

        if (title !== undefined) updateData.title = title;
        if (domain !== undefined) updateData.domain = domain;

        const { error: updateError } = await supabase
          .from('staff_flow_sessions')
          .update(updateData)
          .eq('id', sessionId);

        if (updateError) {
          console.error('[manage_staff_flow_session] Error saving response:', updateError);
          return new Response(
            JSON.stringify({ error: 'Failed to save response' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, responses: newResponses }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'delete_session': {
        const { sessionId } = body;
        if (!sessionId) {
          return new Response(
            JSON.stringify({ error: 'Session ID required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { error: deleteError } = await supabase
          .from('staff_flow_sessions')
          .delete()
          .eq('id', sessionId)
          .eq('staff_user_id', staffUserId);

        if (deleteError) {
          console.error('[manage_staff_flow_session] Error deleting session:', deleteError);
          return new Response(
            JSON.stringify({ error: 'Failed to delete session' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'complete_session': {
        const { sessionId } = body;
        if (!sessionId) {
          return new Response(
            JSON.stringify({ error: 'Session ID required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { error: updateError } = await supabase
          .from('staff_flow_sessions')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', sessionId)
          .eq('staff_user_id', staffUserId);

        if (updateError) {
          console.error('[manage_staff_flow_session] Error completing session:', updateError);
          return new Response(
            JSON.stringify({ error: 'Failed to complete session' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('[manage_staff_flow_session] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
