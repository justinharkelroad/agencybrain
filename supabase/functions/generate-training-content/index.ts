import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    // --- Auth: extract JWT, verify user, check admin or flag ---
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const jwt = authHeader.replace('Bearer ', '');
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser(jwt);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const { mode, agency_id, topic, lesson_name, lesson_content, question_count, existing_content, rewrite_mode } = await req.json();

    if (!mode) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: mode' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check admin status
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const isAdmin = profile?.role === 'admin';

    // If not admin, agency_id is required and flag must be enabled
    if (!isAdmin) {
      if (!agency_id) {
        return new Response(
          JSON.stringify({ error: 'Missing required field: agency_id' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: agency } = await supabase
        .from('agencies')
        .select('ai_training_enabled')
        .eq('id', agency_id)
        .single();

      if (!agency?.ai_training_enabled) {
        return new Response(
          JSON.stringify({ error: 'AI training not enabled for this agency' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Strip markdown code fences that GPT sometimes wraps around HTML output
    const stripCodeFences = (text: string): string => {
      const fenced = text.match(/^```(?:html)?\s*\n([\s\S]*?)\n```\s*$/);
      return fenced ? fenced[1] : text;
    };

    // --- Mode routing ---
    if (mode === 'generate_lesson') {
      if (!topic) {
        return new Response(
          JSON.stringify({ error: 'Missing required field: topic' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const systemPrompt = `You are an expert insurance agency trainer writing lesson content for agency staff. Write clear, practical, structured lesson content in clean HTML. Use <h3> for section headers, <p> for paragraphs, and <ul><li> for bullet lists. Do not use markdown. Write in a professional but approachable tone. Focus on actionable steps staff can apply immediately. Keep it under 600 words.`;

      const userPrompt = `Write a training lesson about: ${topic}\n\nLesson title: ${lesson_name || 'Training Lesson'}`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 2000,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenAI API error:', response.status, errorText);
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const content_html = stripCodeFences(data.choices[0].message.content);

      return new Response(
        JSON.stringify({ content_html }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (mode === 'generate_quiz') {
      if (!lesson_content) {
        return new Response(
          JSON.stringify({ error: 'Missing required field: lesson_content' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const count = question_count || 5;

      const systemPrompt = `You are creating quiz questions for an insurance agency training lesson. Generate exactly ${count} multiple choice questions based on the lesson content provided. Each question must have exactly 4 options with exactly 1 correct answer. Return a JSON object with a "questions" key containing an array with this structure:
{
  "questions": [
    {
      "question_text": "...",
      "options": [
        { "option_text": "...", "is_correct": true },
        { "option_text": "...", "is_correct": false },
        { "option_text": "...", "is_correct": false },
        { "option_text": "...", "is_correct": false }
      ]
    }
  ]
}`;

      const userPrompt = `Lesson title: ${lesson_name || 'Training Lesson'}\n\nLesson content:\n${lesson_content}`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 3000,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenAI API error:', response.status, errorText);
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;

      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        throw new Error('Failed to parse quiz questions from AI response');
      }

      const questions = parsed.questions;
      if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error('AI response did not contain a valid questions array');
      }

      // Validate structure
      for (const q of questions) {
        if (!q.question_text || !Array.isArray(q.options) || q.options.length !== 4) {
          throw new Error('Invalid question structure in AI response');
        }
        const correctCount = q.options.filter((o: { is_correct: boolean }) => o.is_correct).length;
        if (correctCount !== 1) {
          throw new Error('Each question must have exactly 1 correct answer');
        }
      }

      return new Response(
        JSON.stringify({ questions }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (mode === 'rewrite_content') {
      if (!existing_content) {
        return new Response(
          JSON.stringify({ error: 'Missing required field: existing_content' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const rewritePrompts: Record<string, string> = {
        clearer: 'Rewrite the following insurance agency training content to be clearer and easier to understand for agents, while preserving all key information. Return only clean HTML using <p>, <h3>, and <ul><li> tags.',
        concise: 'Rewrite the following insurance agency training content to be more concise — remove redundancy and tighten every sentence. Preserve all key information. Return only clean HTML.',
        actionable: 'Rewrite the following insurance agency training content to be more actionable — convert abstract concepts into specific steps agents can immediately take. Return only clean HTML.',
        beginner_friendly: 'Rewrite the following insurance agency training content for someone brand new to insurance. Define any jargon. Use simple, direct language. Return only clean HTML.',
      };

      const selectedMode = rewrite_mode || 'clearer';
      const systemPrompt = rewritePrompts[selectedMode];

      if (!systemPrompt) {
        return new Response(
          JSON.stringify({ error: `Invalid rewrite_mode: ${selectedMode}. Must be one of: clearer, concise, actionable, beginner_friendly` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: existing_content },
          ],
          temperature: 0.7,
          max_tokens: 2000,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenAI API error:', response.status, errorText);
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const content_html = stripCodeFences(data.choices[0].message.content);

      return new Response(
        JSON.stringify({ content_html }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Unknown mode
    return new Response(
      JSON.stringify({ error: `Unknown mode: ${mode}. Must be one of: generate_lesson, generate_quiz, rewrite_content` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('generate-training-content error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
