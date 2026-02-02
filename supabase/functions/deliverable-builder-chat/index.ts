import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.32.1';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')!;

type DeliverableType = 'sales_process' | 'accountability_metrics' | 'consequence_ladder';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface StartSessionBody {
  action: 'start';
  deliverable_id: string;
}

interface SendMessageBody {
  action: 'message';
  session_id: string;
  message: string;
}

interface GetSessionBody {
  action: 'get_session';
  deliverable_id: string;
}

interface ApplyContentBody {
  action: 'apply';
  session_id: string;
}

type RequestBody = StartSessionBody | SendMessageBody | GetSessionBody | ApplyContentBody;

// Extract JSON from AI response
function extractJsonFromResponse(text: string): Record<string, unknown> | null {
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1]);
    } catch {
      return null;
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user's auth token
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get the authenticated user
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user's profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, agency_id, role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'Profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isAdmin = profile.role === 'admin';

    // Check if user is agency owner (has agency_id) or key employee
    let isOwnerOrManager = !!profile.agency_id;

    if (!isOwnerOrManager) {
      // Check key_employees table
      const { data: keyEmployee } = await supabase
        .from('key_employees')
        .select('agency_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (keyEmployee?.agency_id) {
        isOwnerOrManager = true;
        profile.agency_id = keyEmployee.agency_id;
      }
    }

    if (!isAdmin && !isOwnerOrManager) {
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: RequestBody = await req.json();

    switch (body.action) {
      case 'start': {
        const { deliverable_id } = body as StartSessionBody;

        if (!deliverable_id) {
          return new Response(
            JSON.stringify({ error: 'Missing deliverable_id' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get deliverable and verify access
        const { data: deliverable, error: deliverableError } = await supabase
          .from('sales_experience_deliverables')
          .select(`
            *,
            sales_experience_assignments(id, agency_id, status)
          `)
          .eq('id', deliverable_id)
          .single();

        if (deliverableError || !deliverable) {
          return new Response(
            JSON.stringify({ error: 'Deliverable not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const assignment = deliverable.sales_experience_assignments as { id: string; agency_id: string; status: string };
        if (!isAdmin && assignment.agency_id !== profile.agency_id) {
          return new Response(
            JSON.stringify({ error: 'Access denied' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check for existing active session
        const { data: existingSession } = await supabase
          .from('sales_experience_deliverable_sessions')
          .select('*')
          .eq('deliverable_id', deliverable_id)
          .eq('user_id', user.id)
          .eq('status', 'in_progress')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingSession) {
          return new Response(
            JSON.stringify({ session: existingSession }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get the AI prompt for this deliverable type
        const promptKey = `deliverable_${deliverable.deliverable_type}`;
        const { data: promptData } = await supabase
          .from('sales_experience_ai_prompts')
          .select('prompt_template')
          .eq('prompt_key', promptKey)
          .single();

        const systemPrompt = promptData?.prompt_template || 'You are a helpful assistant.';

        // Initialize the Anthropic client
        const anthropic = new Anthropic({ apiKey: anthropicApiKey });

        // Map deliverable type to friendly name and initial prompt
        const deliverableContext: Record<DeliverableType, { name: string; opener: string }> = {
          sales_process: {
            name: 'Sales Process',
            opener: "Hi, I'm ready to build my agency's Sales Process. Let's get started.",
          },
          accountability_metrics: {
            name: 'Accountability Metrics',
            opener: "Hi, I want to define the accountability metrics for my team.",
          },
          consequence_ladder: {
            name: 'Consequence Ladder',
            opener: "Hi, I need to create a consequence ladder for performance management.",
          },
        };

        const context = deliverableContext[deliverable.deliverable_type as DeliverableType];
        const userOpener = context?.opener || 'Hi, I want to build my deliverable.';

        // Get initial greeting from AI
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2048,
          system: systemPrompt,
          messages: [{ role: 'user', content: userOpener }],
        });

        const assistantMessage = response.content[0].type === 'text' ? response.content[0].text : '';

        // Create new session
        const initialMessages: ChatMessage[] = [
          { role: 'user', content: userOpener },
          { role: 'assistant', content: assistantMessage },
        ];

        const { data: newSession, error: createError } = await supabase
          .from('sales_experience_deliverable_sessions')
          .insert({
            deliverable_id,
            user_id: user.id,
            messages_json: initialMessages,
            status: 'in_progress',
          })
          .select()
          .single();

        if (createError) {
          console.error('Create session error:', createError);
          return new Response(
            JSON.stringify({ error: 'Failed to create session' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Update deliverable status to in_progress
        await supabase
          .from('sales_experience_deliverables')
          .update({ status: 'in_progress' })
          .eq('id', deliverable_id)
          .eq('status', 'draft');

        return new Response(
          JSON.stringify({ session: newSession }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get_session': {
        const { deliverable_id } = body as GetSessionBody;

        if (!deliverable_id) {
          return new Response(
            JSON.stringify({ error: 'Missing deliverable_id' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get existing session
        const { data: session } = await supabase
          .from('sales_experience_deliverable_sessions')
          .select('*')
          .eq('deliverable_id', deliverable_id)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        return new Response(
          JSON.stringify({ session }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'message': {
        const { session_id, message } = body as SendMessageBody;

        if (!session_id || !message?.trim()) {
          return new Response(
            JSON.stringify({ error: 'Missing session_id or message' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get session and verify ownership
        const { data: session, error: sessionError } = await supabase
          .from('sales_experience_deliverable_sessions')
          .select(`
            *,
            sales_experience_deliverables(deliverable_type, sales_experience_assignments(agency_id))
          `)
          .eq('id', session_id)
          .single();

        if (sessionError || !session) {
          return new Response(
            JSON.stringify({ error: 'Session not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (session.user_id !== user.id) {
          return new Response(
            JSON.stringify({ error: 'Access denied' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (session.status !== 'in_progress') {
          return new Response(
            JSON.stringify({ error: 'Session is not active' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const deliverable = session.sales_experience_deliverables as { deliverable_type: DeliverableType };
        const promptKey = `deliverable_${deliverable.deliverable_type}`;

        // Get the AI prompt
        const { data: promptData } = await supabase
          .from('sales_experience_ai_prompts')
          .select('prompt_template')
          .eq('prompt_key', promptKey)
          .single();

        const systemPrompt = promptData?.prompt_template || 'You are a helpful assistant.';

        // Build conversation history
        const messages = session.messages_json as ChatMessage[];
        messages.push({ role: 'user', content: message.trim() });

        // Call Claude API
        const anthropic = new Anthropic({ apiKey: anthropicApiKey });
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2048,
          system: systemPrompt,
          messages: messages.map(m => ({ role: m.role, content: m.content })),
        });

        const assistantMessage = response.content[0].type === 'text' ? response.content[0].text : '';
        messages.push({ role: 'assistant', content: assistantMessage });

        // Check if AI generated structured content
        const generatedContent = extractJsonFromResponse(assistantMessage);

        // Update session
        const { error: updateError } = await supabase
          .from('sales_experience_deliverable_sessions')
          .update({
            messages_json: messages,
            generated_content_json: generatedContent || session.generated_content_json,
          })
          .eq('id', session_id);

        if (updateError) {
          console.error('Update session error:', updateError);
          return new Response(
            JSON.stringify({ error: 'Failed to update session' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({
            message: assistantMessage,
            generated_content: generatedContent,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'apply': {
        const { session_id } = body as ApplyContentBody;

        if (!session_id) {
          return new Response(
            JSON.stringify({ error: 'Missing session_id' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get session and verify ownership
        const { data: session, error: sessionError } = await supabase
          .from('sales_experience_deliverable_sessions')
          .select('*')
          .eq('id', session_id)
          .single();

        if (sessionError || !session) {
          return new Response(
            JSON.stringify({ error: 'Session not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (session.user_id !== user.id) {
          return new Response(
            JSON.stringify({ error: 'Access denied' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (!session.generated_content_json) {
          return new Response(
            JSON.stringify({ error: 'No generated content to apply' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Update deliverable with generated content
        const { error: deliverableError } = await supabase
          .from('sales_experience_deliverables')
          .update({
            content_json: session.generated_content_json,
            status: 'complete',
          })
          .eq('id', session.deliverable_id);

        if (deliverableError) {
          console.error('Update deliverable error:', deliverableError);
          return new Response(
            JSON.stringify({ error: 'Failed to apply content' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Mark session as completed
        await supabase
          .from('sales_experience_deliverable_sessions')
          .update({ status: 'completed' })
          .eq('id', session_id);

        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action. Must be: start, get_session, message, or apply' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Deliverable builder chat error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to process request' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
