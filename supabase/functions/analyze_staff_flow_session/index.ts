import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-staff-session',
}

// Flow category detection for context-aware prompting
interface FlowCategory {
  category: 'vent' | 'gratitude' | 'spiritual' | 'strategic' | 'learning';
  displayName: string;
  emotionalState: string;
}

function getFlowCategory(flowSlug: string, flowName: string): FlowCategory {
  const slug = flowSlug?.toLowerCase() || '';
  const name = flowName?.toLowerCase() || '';
  
  if (slug.includes('irritation') || slug.includes('vent') || name.includes('irritation') || name.includes('vent')) {
    return { category: 'vent', displayName: 'Irritation/Vent', emotionalState: 'frustrated, seeking clarity and release' };
  }
  
  if (slug.includes('grateful') || slug.includes('gratitude') || name.includes('grateful') || name.includes('gratitude')) {
    return { category: 'gratitude', displayName: 'Gratitude', emotionalState: 'appreciative, wanting to anchor and expand' };
  }
  
  if (slug.includes('prayer') || slug.includes('bible') || slug.includes('faith') || 
      name.includes('prayer') || name.includes('bible') || name.includes('faith')) {
    return { category: 'spiritual', displayName: 'Prayer/Bible', emotionalState: 'seeking spiritual alignment and guidance' };
  }
  
  if (slug.includes('war') || slug.includes('idea') || slug.includes('plan') || slug.includes('strategy') ||
      name.includes('war') || name.includes('idea') || name.includes('plan') || name.includes('strategy')) {
    return { category: 'strategic', displayName: flowName, emotionalState: 'action-oriented, planning and problem-solving' };
  }
  
  if (slug.includes('discovery') || slug.includes('learn') || slug.includes('insight') ||
      name.includes('discovery') || name.includes('learn') || name.includes('insight')) {
    return { category: 'learning', displayName: 'Discovery', emotionalState: 'curious, integrating new insights' };
  }
  
  return { category: 'learning', displayName: flowName, emotionalState: 'reflective, processing experiences' };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const staffSessionToken = req.headers.get('x-staff-session')
    
    if (!staffSessionToken) {
      return new Response(
        JSON.stringify({ error: 'Staff session token required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { session_id } = await req.json()

    if (!session_id) {
      return new Response(
        JSON.stringify({ error: 'session_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify staff session
    const { data: sessionData, error: sessionVerifyError } = await supabase
      .from('staff_sessions')
      .select('staff_user_id, expires_at')
      .eq('session_token', staffSessionToken)
      .maybeSingle()

    if (sessionVerifyError || !sessionData) {
      return new Response(
        JSON.stringify({ error: 'Invalid staff session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (new Date(sessionData.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'Staff session expired' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const staffUserId = sessionData.staff_user_id

    // Fetch the staff flow session with template
    const { data: session, error: sessionError } = await supabase
      .from('staff_flow_sessions')
      .select('*, flow_template:flow_templates(*)')
      .eq('id', session_id)
      .eq('staff_user_id', staffUserId)
      .single()

    if (sessionError || !session) {
      console.error('Staff session fetch error:', sessionError)
      return new Response(
        JSON.stringify({ error: 'Session not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch staff user's flow profile
    const { data: profile } = await supabase
      .from('staff_flow_profiles')
      .select('*')
      .eq('staff_user_id', staffUserId)
      .maybeSingle()

    // Parse template questions
    const questions = typeof session.flow_template.questions_json === 'string'
      ? JSON.parse(session.flow_template.questions_json)
      : session.flow_template.questions_json

    // Build Q&A pairs for the prompt
    const qaPairs = questions.map((q: any) => ({
      question: q.prompt,
      answer: session.responses_json?.[q.id] || '(not answered)',
    }))

    // Detect flow category
    const flowCategory = getFlowCategory(
      session.flow_template.slug || '',
      session.flow_template.name || ''
    )

    const systemPrompt = buildSystemPrompt(flowCategory, profile)
    const userPrompt = buildUserPrompt(session, qaPairs, flowCategory)

    console.log('Calling OpenAI for staff session:', session_id, 'Flow category:', flowCategory.category)

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
        max_tokens: 2500,
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

    let analysis
    try {
      const jsonMatch = aiContent.match(/```json\s*([\s\S]*?)\s*```/) || 
                        aiContent.match(/```\s*([\s\S]*?)\s*```/)
      const jsonString = jsonMatch ? jsonMatch[1] : aiContent
      analysis = JSON.parse(jsonString.trim())
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError, 'Raw:', aiContent)
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

    // Save analysis to staff flow session
    const { error: updateError } = await supabase
      .from('staff_flow_sessions')
      .update({
        ai_analysis_json: analysis,
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', session_id)

    if (updateError) {
      console.error('Failed to save analysis:', updateError)
    }

    console.log('Analysis saved successfully for staff session:', session_id)

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

function buildSystemPrompt(flowCategory: FlowCategory, profile: any): string {
  let profileContext = ''
  
  if (profile) {
    const parts = []
    if (profile.preferred_name) parts.push(`Name: ${profile.preferred_name}`)
    if (profile.life_roles?.length) parts.push(`Life Roles: ${profile.life_roles.join(', ')}`)
    if (profile.core_values?.length) parts.push(`Core Values: ${profile.core_values.join(', ')}`)
    if (profile.current_goals) parts.push(`Current 90-Day Focus: ${profile.current_goals}`)
    if (profile.current_challenges) parts.push(`Recurring Patterns/Challenges: ${profile.current_challenges}`)
    if (profile.peak_state) parts.push(`Peak State: ${profile.peak_state}`)
    if (profile.growth_edge) parts.push(`Growth Edge: ${profile.growth_edge}`)
    if (profile.overwhelm_response) parts.push(`Overwhelm Response: ${profile.overwhelm_response}`)
    if (profile.spiritual_beliefs) parts.push(`Spiritual Context: ${profile.spiritual_beliefs}`)
    if (profile.background_notes) parts.push(`Additional Context: ${profile.background_notes}`)
    
    if (parts.length > 0) {
      profileContext = `\n=== USER PROFILE CONTEXT ===\n${parts.join('\n')}\n`
    }
  }

  let responseCalibration = ''
  if (profile?.accountability_style || profile?.feedback_preference) {
    const calibrationParts = []
    
    if (profile.accountability_style === 'direct_challenge') {
      calibrationParts.push(`ACCOUNTABILITY STYLE = Direct Challenge`)
    } else if (profile.accountability_style === 'gentle_nudge') {
      calibrationParts.push(`ACCOUNTABILITY STYLE = Gentle Nudge`)
    } else if (profile.accountability_style === 'questions_discover') {
      calibrationParts.push(`ACCOUNTABILITY STYLE = Socratic Questions`)
    }
    
    if (profile.feedback_preference === 'blunt_truth') {
      calibrationParts.push(`FEEDBACK = Blunt Truth`)
    } else if (profile.feedback_preference === 'encouragement_then_truth') {
      calibrationParts.push(`FEEDBACK = Encouragement then Truth`)
    } else if (profile.feedback_preference === 'questions_to_discover') {
      calibrationParts.push(`FEEDBACK = Socratic Approach`)
    }
    
    if (calibrationParts.length > 0) {
      responseCalibration = `\n=== RESPONSE CALIBRATION ===\n${calibrationParts.join('\n')}\n`
    }
  }

  return `You are "Agency Brain" — a wise, empathetic accountability partner for insurance professionals.

Current Flow Type: ${flowCategory.displayName}
User's Emotional State: ${flowCategory.emotionalState}
${profileContext}
${responseCalibration}

=== THERAPEUTIC FRAMEWORK ===
A. VALIDATE: Make the user feel SEEN.
B. REFRAME: Connect their input to their core values or growth edge.
C. ANCHOR: Provide actionable insight.

=== REQUIRED JSON OUTPUT ===
Respond ONLY with valid JSON:
{
  "headline": "5-8 word insight naming their core dynamic",
  "congratulations": "1-2 sentences acknowledging something SPECIFIC they revealed",
  "deep_dive_insight": "2-3 sentences revealing a pattern they didn't explicitly state",
  "connections": ["2-3 connections to their values/goals"],
  "themes": ["2-4 word themes from their reflection"],
  "provocative_question": "One question to sit with",
  "suggested_action": "One micro-step for the next 24 hours or null"
}`
}

function buildUserPrompt(session: any, qaPairs: any[], flowCategory: FlowCategory): string {
  const qaFormatted = qaPairs.map(qa => `Q: ${qa.question}\nA: ${qa.answer}`).join('\n\n')
  
  return `Analyze this ${flowCategory.displayName} flow and provide personalized insights.

=== FLOW DETAILS ===
Title: ${session.title || 'Untitled'}
Domain: ${session.domain || 'Not specified'}

=== RESPONSES ===
${qaFormatted}

Provide your analysis as JSON.`
}
