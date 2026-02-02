import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');

interface RequestBody {
  assignment_id: string;
  week_number: number;
  meeting_date: string;
  transcript_text: string;
}

async function generateAISummary(transcriptText: string, promptTemplate: string): Promise<{
  summary: string;
  action_items: any[];
  key_points: any[];
}> {
  // If no API key, return empty results
  if (!anthropicApiKey) {
    console.warn('No ANTHROPIC_API_KEY configured, skipping AI summarization');
    return {
      summary: '',
      action_items: [],
      key_points: [],
    };
  }

  try {
    // Replace template variable
    const prompt = promptTemplate.replace('{{transcript}}', transcriptText);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error('Anthropic API error:', await response.text());
      return { summary: '', action_items: [], key_points: [] };
    }

    const data = await response.json();
    const aiResponse = data.content?.[0]?.text || '';

    return {
      summary: aiResponse,
      action_items: [], // Could parse from response
      key_points: [], // Could parse from response
    };
  } catch (error) {
    console.error('AI summarization error:', error);
    return { summary: '', action_items: [], key_points: [] };
  }
}

async function extractActionItems(transcriptText: string, promptTemplate: string): Promise<any[]> {
  if (!anthropicApiKey) {
    return [];
  }

  try {
    const prompt = promptTemplate.replace('{{transcript}}', transcriptText);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    const aiResponse = data.content?.[0]?.text || '';

    // Try to parse JSON from response
    try {
      const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {
      // Not valid JSON, return empty
    }

    return [];
  } catch (error) {
    console.error('Action items extraction error:', error);
    return [];
  }
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
    // Get authorization header (admin only)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: RequestBody = await req.json();
    const { assignment_id, week_number, meeting_date, transcript_text } = body;

    if (!assignment_id || !week_number || !meeting_date || !transcript_text) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (week_number < 1 || week_number > 8) {
      return new Response(
        JSON.stringify({ error: 'Week number must be between 1 and 8' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify assignment exists
    const { data: assignment, error: assignmentError } = await supabase
      .from('sales_experience_assignments')
      .select('id')
      .eq('id', assignment_id)
      .single();

    if (assignmentError || !assignment) {
      return new Response(
        JSON.stringify({ error: 'Assignment not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get AI prompts from database
    const { data: prompts } = await supabase
      .from('sales_experience_ai_prompts')
      .select('prompt_key, prompt_template')
      .in('prompt_key', ['transcript_summary', 'action_items_extraction']);

    const summaryPrompt = prompts?.find(p => p.prompt_key === 'transcript_summary')?.prompt_template || '';
    const actionItemsPrompt = prompts?.find(p => p.prompt_key === 'action_items_extraction')?.prompt_template || '';

    // Generate AI summary and extract action items in parallel
    const [summaryResult, actionItems] = await Promise.all([
      generateAISummary(transcript_text, summaryPrompt),
      extractActionItems(transcript_text, actionItemsPrompt),
    ]);

    // Upsert transcript record
    const { data: transcript, error: upsertError } = await supabase
      .from('sales_experience_transcripts')
      .upsert({
        assignment_id,
        week_number,
        meeting_date,
        transcript_text,
        summary_ai: summaryResult.summary,
        action_items_json: actionItems,
        key_points_json: summaryResult.key_points,
        uploaded_by: user.id,
      }, {
        onConflict: 'assignment_id,week_number',
      })
      .select()
      .single();

    if (upsertError) {
      console.error('Transcript upsert error:', upsertError);
      return new Response(
        JSON.stringify({ error: 'Failed to save transcript' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        transcript: {
          id: transcript.id,
          week_number: transcript.week_number,
          meeting_date: transcript.meeting_date,
          summary_ai: transcript.summary_ai,
          action_items_json: transcript.action_items_json,
          has_ai_summary: !!transcript.summary_ai,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Upload sales transcript error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to upload transcript' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
