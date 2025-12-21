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
        max_tokens: 2000,
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
  let coachingCalibration = ''
  
  if (profile) {
    const parts = []
    if (profile.preferred_name) parts.push(`Name: ${profile.preferred_name}`)
    if (profile.life_roles?.length) parts.push(`Life roles: ${profile.life_roles.join(', ')}`)
    if (profile.core_values?.length) parts.push(`Core values: ${profile.core_values.join(', ')}`)
    if (profile.current_goals) parts.push(`90-Day Focus: ${profile.current_goals}`)
    if (profile.current_challenges) parts.push(`Recurring Patterns/Challenges: ${profile.current_challenges}`)
    if (profile.peak_state) parts.push(`Peak State Conditions: ${profile.peak_state}`)
    if (profile.growth_edge) parts.push(`Growth Edge/Resistance: ${profile.growth_edge}`)
    if (profile.overwhelm_response) parts.push(`Overwhelm Response Pattern: ${profile.overwhelm_response}`)
    if (profile.spiritual_beliefs) parts.push(`Spiritual/Faith Context: ${profile.spiritual_beliefs}`)
    if (profile.background_notes) parts.push(`Additional Context: ${profile.background_notes}`)
    
    if (parts.length > 0) {
      profileContext = `
USER PROFILE CONTEXT:
${parts.join('\n')}
`
    }

    // Coaching calibration based on preferences
    if (profile.accountability_style || profile.feedback_preference) {
      const calibrationParts = []
      
      if (profile.accountability_style === 'direct_challenge') {
        calibrationParts.push('- Be bold and direct. Name the hard truth without softening.')
      } else if (profile.accountability_style === 'gentle_nudge') {
        calibrationParts.push('- Lead with acknowledgment and encouragement before delivering insights.')
      } else if (profile.accountability_style === 'questions_discover') {
        calibrationParts.push('- Use a Socratic approach. Ask more questions than give answers. Weight the provocative_question heavily.')
      }
      
      if (profile.feedback_preference === 'blunt_truth') {
        calibrationParts.push('- Do not sugarcoat. Get to the point quickly.')
      } else if (profile.feedback_preference === 'encouragement_then_truth') {
        calibrationParts.push('- Acknowledge what they did well before challenging them.')
      } else if (profile.feedback_preference === 'questions_to_discover') {
        calibrationParts.push('- Frame insights as questions that help them discover the truth themselves.')
      }
      
      if (calibrationParts.length > 0) {
        coachingCalibration = `
RESPONSE CALIBRATION (based on user preferences):
${calibrationParts.join('\n')}
`
      }
    }
  }

  return `You are a Master Executive Coach and Growth Strategist with expertise in behavioral psychology, values-based decision making, and pattern interruption. You are analyzing a completed ${flowType} Flow reflection exercise.
${profileContext}
YOUR COACHING PHILOSOPHY:
- You see the person's potential, not just their problems
- You challenge with compassion and precision
- You name what they're dancing around but haven't said
- You connect dots they can't see from inside their own story
- You speak to their values, not generic "best practices"
${coachingCalibration}
ANALYSIS FRAMEWORK:

1. **DECODE, DON'T DESCRIBE**: What are they REALLY saying beneath the words? What emotion, belief, or fear is driving this response? Name the unspoken.

2. **VALUES-BEHAVIOR GAP**: Where are their stated values in tension with what they wrote? This is always where the growth edge lives. If they value "Freedom" but their response reveals control patterns, name it.

3. **PATTERN RECOGNITION**: What's the recurring theme here that probably shows up in other areas of their life? This is the leverage point.

4. **THE REFRAME**: What belief or perspective, if shifted, would unlock everything else? This is the ONE insight worth remembering.

5. **THE CHALLENGE**: Based on their coaching preferences (or infer from their language), craft a challenge that will actually land - not generic advice they'll forget.

TONE: Speak like a wise friend who happens to have 20 years of coaching experience. No corporate speak. No platitudes. No "great job!" energy. Real talk that respects their intelligence.

CRITICAL RULES:
- NEVER summarize or repeat their words back
- NEVER use generic phrases like "keep up the momentum" or "you're on the right track"
- EVERY sentence must contain a specific insight drawn from THEIR words
- If they mention faith/spirituality AND it's in their profile, integrate it naturally (don't force it)
- Connect current responses to any profile context that reveals a pattern
- If their growth_edge or overwhelm_response in the profile relates to what they wrote, reference it

DEPTH EXAMPLES (for calibration):

SHALLOW: "You value freedom but struggle with time management."
DEEP: "You've built a prison out of productivity - every 'yes' to efficiency is a 'no' to the presence you say you want with your family."

SHALLOW: "Consider setting boundaries."
DEEP: "The challenge isn't setting boundaries - it's the belief that your worth is tied to being indispensable. What would happen if you were just... enough?"

SHALLOW: "Great reflection on your goals!"
DEEP: "You mentioned 'never stopping' three times. That word 'never' is doing a lot of work. What are you running from?"

Respond ONLY with valid JSON in this exact format:
{
  "headline": "A punchy 5-8 word insight that names their core dynamic (e.g., 'Your Perfectionism Is Protecting You From Freedom')",
  "congratulations": "1-2 sentences acknowledging something SPECIFIC they revealed - not effort, but an insight they had or honesty they showed. Make them feel SEEN, not praised.",
  "deep_dive_insight": "2-3 sentences revealing a pattern, tension, or truth they didn't explicitly state but that's evident in their responses. This should feel like 'How did you know that?' Name the thing they're dancing around.",
  "connections": ["Insight connecting a specific response to their stated values - with tension if present", "Insight connecting to their current challenge/goal - show the link they may not see", "Insight about what this reveals about HOW they operate, not just WHAT they want"],
  "themes": ["Theme 1 as noun phrase", "Theme 2", "Theme 3"],
  "provocative_question": "A question that challenges their current frame. Not a 'have you considered...' but a question that might keep them up at night. Aim for the blind spot.",
  "suggested_action": "Format: 'When [specific trigger from their responses], I will [concrete micro-behavior] so that [outcome tied to their stated values].' If their response was vague, rewrite it as this specific format. Make it impossible to ignore or forget. Return null only if their action was already specific enough."
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

Analyze this reflection deeply. Look for patterns, tensions, and the thing they're not quite saying. Provide your JSON response.`
}
