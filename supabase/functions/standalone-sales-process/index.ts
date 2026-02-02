import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.32.1';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')!;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface SalesProcessContent {
  rapport: string[];
  coverage: string[];
  closing: string[];
}

interface StartSessionBody {
  action: 'start';
}

interface SendMessageBody {
  action: 'message';
  session_id: string;
  message: string;
}

interface GetStatusBody {
  action: 'get';
}

interface SaveContentBody {
  action: 'save';
  content: SalesProcessContent;
  mark_complete?: boolean;
}

interface ApplyContentBody {
  action: 'apply';
  session_id: string;
}

type RequestBody = StartSessionBody | SendMessageBody | GetStatusBody | SaveContentBody | ApplyContentBody;

// Extract JSON from AI response
function extractJsonFromResponse(text: string): SalesProcessContent | null {
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1]) as SalesProcessContent;
    } catch {
      return null;
    }
  }
  return null;
}

// Default system prompt (can be overridden from database)
const DEFAULT_SYSTEM_PROMPT = `# Role & Objective
You are the **AgencyBrain Sales Architect**. Your mission is to help an insurance agency owner build a structured, professional Sales Process.

You guide them through three phases: Rapport, Coverage, and Closing. Ask questions, understand their current approach, and help them articulate their process clearly.

# Output Rules
After gathering the details for all three phases, provide a summary of their new playbook. Then, output the structured data in this exact JSON format at the very END of your response:

\`\`\`json
{"rapport": ["item1", "item2"], "coverage": ["item1", "item2"], "closing": ["item1", "item2"]}
\`\`\`

Keep responses concise and focused. Ask one or two questions at a time.`;

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

    // Get user's profile and agency
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

    // Determine agency_id (could be from profile or key_employees)
    let agencyId = profile.agency_id;

    if (!agencyId) {
      const { data: keyEmployee } = await supabase
        .from('key_employees')
        .select('agency_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (keyEmployee?.agency_id) {
        agencyId = keyEmployee.agency_id;
      }
    }

    if (!agencyId) {
      return new Response(
        JSON.stringify({ error: 'No agency found for user' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if agency has access to sales_process_builder feature
    const { data: featureAccess } = await supabase
      .from('agency_feature_access')
      .select('id')
      .eq('agency_id', agencyId)
      .eq('feature_key', 'sales_process_builder')
      .maybeSingle();

    if (!featureAccess) {
      // Return 200 with hasAccess: false instead of 403 to avoid triggering error trackers
      return new Response(
        JSON.stringify({ hasAccess: false, sales_process: null, session: null }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: RequestBody = await req.json();

    // Get system prompt from database (or use default)
    const { data: promptData } = await supabase
      .from('sales_experience_ai_prompts')
      .select('prompt_template')
      .eq('prompt_key', 'deliverable_sales_process')
      .single();

    const systemPrompt = promptData?.prompt_template || DEFAULT_SYSTEM_PROMPT;

    switch (body.action) {
      case 'get': {
        // Get or create the sales process record for this agency
        let { data: salesProcess } = await supabase
          .from('standalone_sales_process')
          .select('*')
          .eq('agency_id', agencyId)
          .maybeSingle();

        // Get any existing session
        let session = null;
        if (salesProcess) {
          const { data: existingSession } = await supabase
            .from('standalone_sales_process_sessions')
            .select('*')
            .eq('sales_process_id', salesProcess.id)
            .eq('user_id', user.id)
            .eq('status', 'in_progress')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          session = existingSession;
        }

        return new Response(
          JSON.stringify({ sales_process: salesProcess, session }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'start': {
        // Get or create the sales process record
        let { data: salesProcess } = await supabase
          .from('standalone_sales_process')
          .select('*')
          .eq('agency_id', agencyId)
          .maybeSingle();

        if (!salesProcess) {
          const { data: newSP, error: createSPError } = await supabase
            .from('standalone_sales_process')
            .insert({
              agency_id: agencyId,
              status: 'in_progress',
            })
            .select()
            .single();

          if (createSPError) {
            console.error('Create sales process error:', createSPError);
            return new Response(
              JSON.stringify({ error: 'Failed to create sales process' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          salesProcess = newSP;
        }

        // Check for existing active session
        const { data: existingSession } = await supabase
          .from('standalone_sales_process_sessions')
          .select('*')
          .eq('sales_process_id', salesProcess.id)
          .eq('user_id', user.id)
          .eq('status', 'in_progress')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingSession) {
          return new Response(
            JSON.stringify({ session: existingSession, sales_process: salesProcess }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Initialize the Anthropic client
        const anthropic = new Anthropic({ apiKey: anthropicApiKey });

        const userOpener = "Hi, I'm ready to build my agency's Sales Process. Let's get started.";

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
          .from('standalone_sales_process_sessions')
          .insert({
            sales_process_id: salesProcess.id,
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

        // Update sales process status
        await supabase
          .from('standalone_sales_process')
          .update({ status: 'in_progress' })
          .eq('id', salesProcess.id);

        return new Response(
          JSON.stringify({ session: newSession, sales_process: salesProcess }),
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
          .from('standalone_sales_process_sessions')
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

        if (session.status !== 'in_progress') {
          return new Response(
            JSON.stringify({ error: 'Session is not active' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

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
          .from('standalone_sales_process_sessions')
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

        // Get session
        const { data: session, error: sessionError } = await supabase
          .from('standalone_sales_process_sessions')
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

        // Apply content to sales process
        const { error: updateSPError } = await supabase
          .from('standalone_sales_process')
          .update({
            content_json: session.generated_content_json,
            status: 'in_progress',
          })
          .eq('id', session.sales_process_id);

        if (updateSPError) {
          console.error('Update sales process error:', updateSPError);
          return new Response(
            JSON.stringify({ error: 'Failed to apply content' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Mark session as completed
        await supabase
          .from('standalone_sales_process_sessions')
          .update({ status: 'completed' })
          .eq('id', session_id);

        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'save': {
        const { content, mark_complete } = body as SaveContentBody;

        if (!content) {
          return new Response(
            JSON.stringify({ error: 'Missing content' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Validate content structure
        if (!Array.isArray(content.rapport) || !Array.isArray(content.coverage) || !Array.isArray(content.closing)) {
          return new Response(
            JSON.stringify({ error: 'Invalid content structure' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check if complete enough
        const isComplete = content.rapport.length > 0 && content.coverage.length > 0 && content.closing.length > 0;
        if (mark_complete && !isComplete) {
          return new Response(
            JSON.stringify({ error: 'Content is not complete enough to mark as complete' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get or create sales process
        let { data: salesProcess } = await supabase
          .from('standalone_sales_process')
          .select('*')
          .eq('agency_id', agencyId)
          .maybeSingle();

        if (!salesProcess) {
          const { data: newSP, error: createError } = await supabase
            .from('standalone_sales_process')
            .insert({
              agency_id: agencyId,
              content_json: content,
              status: mark_complete ? 'complete' : 'in_progress',
            })
            .select()
            .single();

          if (createError) {
            console.error('Create sales process error:', createError);
            return new Response(
              JSON.stringify({ error: 'Failed to save content' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          return new Response(
            JSON.stringify({ success: true, sales_process: newSP }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Update existing
        const { data: updated, error: updateError } = await supabase
          .from('standalone_sales_process')
          .update({
            content_json: content,
            status: mark_complete ? 'complete' : (salesProcess.status === 'not_started' ? 'in_progress' : salesProcess.status),
          })
          .eq('id', salesProcess.id)
          .select()
          .single();

        if (updateError) {
          console.error('Update sales process error:', updateError);
          return new Response(
            JSON.stringify({ error: 'Failed to save content' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, sales_process: updated }),
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
    console.error('Standalone sales process error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to process request' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
