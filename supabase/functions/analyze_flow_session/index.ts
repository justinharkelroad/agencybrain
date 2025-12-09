import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { session_id } = await req.json()

    if (!session_id) {
      return new Response(
        JSON.stringify({ error: 'session_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch the session with template
    const { data: session, error: sessionError } = await supabase
      .from('flow_sessions')
      .select('*, flow_template:flow_templates(*)')
      .eq('id', session_id)
      .single()

    if (sessionError || !session) {
      console.error('Session fetch error:', sessionError)
      return new Response(
        JSON.stringify({ error: 'Session not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch user's flow profile
    const { data: profile } = await supabase
      .from('flow_profiles')
      .select('*')
      .eq('user_id', session.user_id)
      .single()

    // Parse template questions
    const questions = typeof session.flow_template.questions_json === 'string'
      ? JSON.parse(session.flow_template.questions_json)
      : session.flow_template.questions_json

    // Build Q&A pairs for the prompt
    const qaPairs = questions.map((q: any) => ({
      question: q.prompt,
      answer: session.responses_json?.[q.id] || '(not answered)',
    }))

    // Build the analysis prompt
    const systemPrompt = buildSystemPrompt(session.flow_template.name, profile)
    const userPrompt = buildUserPrompt(session, qaPairs)

    console.log('Calling OpenAI for session:', session_id)

    // Call OpenAI
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 1500,
      }),
    })

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text()
      console.error('OpenAI API error:', errorText)
      return new Response(
        JSON.stringify({ error: 'AI analysis failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const openaiData = await openaiResponse.json()
    const aiContent = openaiData.choices?.[0]?.message?.content

    if (!aiContent) {
      console.error('No AI content in response')
      return new Response(
        JSON.stringify({ error: 'No AI response generated' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('OpenAI response received, parsing...')

    // Parse the AI response (expecting JSON)
    let analysis
    try {
      // Extract JSON from potential markdown code blocks
      const jsonMatch = aiContent.match(/```json\s*([\s\S]*?)\s*```/) || 
                        aiContent.match(/```\s*([\s\S]*?)\s*```/)
      const jsonString = jsonMatch ? jsonMatch[1] : aiContent
      analysis = JSON.parse(jsonString.trim())
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError, 'Raw:', aiContent)
      // Fallback to basic structure
      analysis = {
        headline: "Reflection Complete",
        congratulations: "Great work completing this flow! Your reflections show real self-awareness.",
        deep_dive_insight: "",
        connections: [],
        themes: [],
        provocative_question: "",
        suggested_action: null,
        raw_response: aiContent,
      }
    }

    // Save analysis to session
    const { error: updateError } = await supabase
      .from('flow_sessions')
      .update({
        ai_analysis_json: analysis,
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', session_id)

    if (updateError) {
      console.error('Failed to save analysis:', updateError)
    }

    console.log('Analysis saved successfully for session:', session_id)

    return new Response(
      JSON.stringify({ success: true, analysis }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function buildSystemPrompt(flowType: string, profile: any): string {
  let profileContext = ''
  
  if (profile) {
    const parts = []
    if (profile.preferred_name) parts.push(`Name: ${profile.preferred_name}`)
    if (profile.life_roles?.length) parts.push(`Life roles: ${profile.life_roles.join(', ')}`)
    if (profile.core_values?.length) parts.push(`Core values: ${profile.core_values.join(', ')}`)
    if (profile.current_goals) parts.push(`Current goals: ${profile.current_goals}`)
    if (profile.current_challenges) parts.push(`Current challenges: ${profile.current_challenges}`)
    
    if (parts.length > 0) {
      profileContext = `
User Profile:
${parts.join('\n')}
`
    }
  }

  return `You are an Expert Growth Strategist analyzing a completed ${flowType} Flow reflection exercise.
${profileContext}
Your job is to provide meaningful insights that reveal patterns and growth opportunities, not summarize what the user already wrote.

ANALYSIS INSTRUCTIONS:
1. **Analyze Don't Summarize**: Never repeat back what they wrote. Instead, interpret the MEANING behind their responses. What does this reveal about how they operate?
2. **Avoid Platitudes**: No generic advice like "keep up the good work" or "you're doing great". Every sentence must contain specific insight drawn from their actual words.
3. **Synthesize Values**: If profile values exist, connect their responses to potential tensions or alignments with those values. If no profile, infer values from their responses.
4. **Identify the Pivot Point**: Find the ONE insight that, if internalized, would create the biggest shift in their thinking or behavior.

Respond ONLY with valid JSON in this exact format:
{
  "headline": "A punchy 5-8 word insight that captures the core theme (e.g., 'Your Creativity Thrives in Structured Chaos')",
  "congratulations": "1-2 sentences acknowledging something SPECIFIC they revealed, not generic praise. Reference exact phrases or themes from their responses.",
  "deep_dive_insight": "2-3 sentences revealing a pattern or tension you noticed. This should be an 'aha' moment they didn't explicitly state. Start with 'I noticed...' or 'There's an interesting tension...'",
  "connections": ["Insight connecting their response to a value/goal #1", "Insight #2 - be specific, not generic"],
  "themes": ["Theme 1 - stated as a noun phrase", "Theme 2", "Theme 3"],
  "provocative_question": "A single thought-provoking question that challenges their current frame or opens a new perspective. This should linger in their mind.",
  "suggested_action": "If their stated action was vague, rewrite it as: 'When [specific trigger], I will [specific behavior] so that [specific outcome]'. If theirs was already specific, return null."
}

Be direct, insightful, and specific. Every word must add value.
Do not include any text outside the JSON object.`
}

function buildUserPrompt(session: any, qaPairs: any[]): string {
  const qaText = qaPairs
    .map((qa: any, i: number) => `Q${i + 1}: ${qa.question}\nA: ${qa.answer}`)
    .join('\n\n')

  return `Here is the completed ${session.flow_template.name} Flow:

Title: ${session.title || 'Untitled'}
Domain: ${session.domain || 'Not specified'}

Responses:
${qaText}

Please analyze this reflection and provide your JSON response.`
}
