import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { user_id, lesson_id, reflections } = await req.json();

    console.log('Processing lesson completion:', { user_id, lesson_id });

    // Fetch user info
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('full_name, email, agency_id')
      .eq('id', user_id)
      .single();

    if (profileError || !profile) {
      console.log('User not found in profiles, may be staff user');
      return new Response(
        JSON.stringify({ success: true, message: 'Non-profile user' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch lesson info
    const { data: lesson } = await supabase
      .from('sp_lessons')
      .select(`
        name,
        module:sp_modules(name, category:sp_categories(name))
      `)
      .eq('id', lesson_id)
      .single();

    console.log('Lesson info:', lesson);

    // Generate AI summary if OpenAI key exists
    let aiSummary = null;
    if (openaiApiKey && reflections) {
      try {
        console.log('Generating AI summary...');
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: `You are an insightful coach summarizing a learner's reflections. Be warm, encouraging, and concise (2-3 sentences). Highlight their key insight and commitment to action.`,
              },
              {
                role: 'user',
                content: `Summarize these lesson reflections:

Biggest Takeaway: ${reflections.takeaway}

Immediate Action: ${reflections.action}

Expected Result: ${reflections.result}`,
              },
            ],
            max_tokens: 150,
          }),
        });

        const aiData = await openaiResponse.json();
        aiSummary = aiData.choices?.[0]?.message?.content;
        console.log('AI summary generated:', aiSummary);

        // Save AI summary to progress
        if (aiSummary) {
          await supabase
            .from('sp_progress')
            .update({ ai_summary: aiSummary })
            .eq('user_id', user_id)
            .eq('lesson_id', lesson_id);
        }
      } catch (aiErr) {
        console.error('AI summary error:', aiErr);
      }
    }

    return new Response(
      JSON.stringify({ success: true, ai_summary: aiSummary }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
