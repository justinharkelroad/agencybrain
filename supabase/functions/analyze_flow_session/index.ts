import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
  
  // Irritation / Vent flows
  if (slug.includes('irritation') || slug.includes('vent') || name.includes('irritation') || name.includes('vent')) {
    return { category: 'vent', displayName: 'Irritation/Vent', emotionalState: 'frustrated, seeking clarity and release' };
  }
  
  // Gratitude flows
  if (slug.includes('grateful') || slug.includes('gratitude') || name.includes('grateful') || name.includes('gratitude')) {
    return { category: 'gratitude', displayName: 'Gratitude', emotionalState: 'appreciative, wanting to anchor and expand' };
  }
  
  // Spiritual / Prayer / Bible flows
  if (slug.includes('prayer') || slug.includes('bible') || slug.includes('faith') || 
      name.includes('prayer') || name.includes('bible') || name.includes('faith')) {
    return { category: 'spiritual', displayName: 'Prayer/Bible', emotionalState: 'seeking spiritual alignment and guidance' };
  }
  
  // Strategic / War / Idea flows
  if (slug.includes('war') || slug.includes('idea') || slug.includes('plan') || slug.includes('strategy') ||
      name.includes('war') || name.includes('idea') || name.includes('plan') || name.includes('strategy')) {
    return { category: 'strategic', displayName: flowName, emotionalState: 'action-oriented, planning and problem-solving' };
  }
  
  // Discovery / Learning flows
  if (slug.includes('discovery') || slug.includes('learn') || slug.includes('insight') ||
      name.includes('discovery') || name.includes('learn') || name.includes('insight')) {
    return { category: 'learning', displayName: 'Discovery', emotionalState: 'curious, integrating new insights' };
  }
  
  // Default: treat as reflective learning
  return { category: 'learning', displayName: flowName, emotionalState: 'reflective, processing experiences' };
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

    // Detect flow category for context-aware prompting
    const flowCategory = getFlowCategory(
      session.flow_template.slug || '',
      session.flow_template.name || ''
    )

    // Build the analysis prompt with therapeutic framework
    const systemPrompt = buildSystemPrompt(flowCategory, profile)
    const userPrompt = buildUserPrompt(session, qaPairs, flowCategory)

    console.log('Calling OpenAI for session:', session_id, 'Flow category:', flowCategory.category)

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

function buildSystemPrompt(flowCategory: FlowCategory, profile: any): string {
  // ====== SECTION 1: DYNAMIC CONTEXT INJECTION ======
  let profileContext = ''
  
  if (profile) {
    const parts = []
    if (profile.preferred_name) parts.push(`Name: ${profile.preferred_name}`)
    if (profile.life_roles?.length) parts.push(`Life Roles: ${profile.life_roles.join(', ')}`)
    if (profile.core_values?.length) parts.push(`Core Values: ${profile.core_values.join(', ')}`)
    if (profile.current_goals) parts.push(`Current 90-Day Focus: ${profile.current_goals}`)
    if (profile.current_challenges) parts.push(`Recurring Patterns/Challenges: ${profile.current_challenges}`)
    if (profile.peak_state) parts.push(`Peak State (when at their best): ${profile.peak_state}`)
    if (profile.growth_edge) parts.push(`Growth Edge (area of resistance): ${profile.growth_edge}`)
    if (profile.overwhelm_response) parts.push(`Overwhelm Response Pattern: ${profile.overwhelm_response}`)
    if (profile.spiritual_beliefs) parts.push(`Spiritual/Faith Context: ${profile.spiritual_beliefs}`)
    if (profile.background_notes) parts.push(`Additional Context: ${profile.background_notes}`)
    
    if (parts.length > 0) {
      profileContext = `
=== USER PROFILE CONTEXT ===
${parts.join('\n')}
`
    }
  }

  // ====== SECTION 2: RESPONSE CALIBRATION ======
  let responseCalibration = ''
  
  if (profile?.accountability_style || profile?.feedback_preference) {
    const calibrationParts = []
    
    // Accountability Style Logic
    if (profile.accountability_style === 'direct_challenge') {
      calibrationParts.push(`ACCOUNTABILITY STYLE = Direct Challenge:
  - Speak the hard truth, but root it in their potential
  - Example tone: "You are frustrated because you know you are capable of better. Here is the gap..."`)
    } else if (profile.accountability_style === 'gentle_nudge') {
      calibrationParts.push(`ACCOUNTABILITY STYLE = Gentle Nudge:
  - Wrap the truth in grace. Validate the emotion first, then offer insight as a stepping stone
  - Lead with acknowledgment before the challenge`)
    } else if (profile.accountability_style === 'questions_discover') {
      calibrationParts.push(`ACCOUNTABILITY STYLE = Questions to Discover:
  - Act as a mirror. Use the Socratic approach
  - Ask: "What does this reaction tell you about your current alignment with [their core value]?"`)
    }
    
    // Feedback Preference Logic
    if (profile.feedback_preference === 'blunt_truth') {
      calibrationParts.push(`FEEDBACK PREFERENCE = Blunt Truth:
  - Cut the fluff, but keep empathy high
  - Get to the point quickly without sugarcoating`)
    } else if (profile.feedback_preference === 'encouragement_then_truth') {
      calibrationParts.push(`FEEDBACK PREFERENCE = Encouragement then Truth:
  - Sandwich the growth point between affirmation and future vision
  - Acknowledge what they did well before challenging them`)
    } else if (profile.feedback_preference === 'questions_to_discover') {
      calibrationParts.push(`FEEDBACK PREFERENCE = Socratic Approach:
  - Frame insights as questions that help them discover the truth themselves
  - Weight the provocative_question heavily in your response`)
    }
    
    if (calibrationParts.length > 0) {
      responseCalibration = `
=== RESPONSE CALIBRATION (based on user preferences) ===
${calibrationParts.join('\n\n')}

IMPORTANT: Adjust your tone based on these settings, but NEVER lose the therapeutic undertone.
`
    }
  }

  // ====== SECTION 3: FLOW-SPECIFIC INSTRUCTIONS ======
  let flowInstructions = ''
  
  switch (flowCategory.category) {
    case 'vent':
      flowInstructions = `
=== FLOW-SPECIFIC INSTRUCTIONS: IRRITATION/VENT ===
Goal: De-escalation and Perspective

Instructions:
- Allow them to feel heard. Validate the frustration before offering perspective.
- Help them separate FACTS from FEELINGS. What actually happened vs. the story they're telling?
- Reference their Overwhelm Response Pattern if it matches what they're describing.
- Suggest ONE small, immediate action to regain a sense of control.
- If their spiritual/faith context supports it, subtly remind them of peace or patience principles.

Key Question to Answer: "What is this frustration trying to teach them?"
`
      break
      
    case 'gratitude':
      flowInstructions = `
=== FLOW-SPECIFIC INSTRUCTIONS: GRATITUDE ===
Goal: Anchoring and Expansion

Instructions:
- Don't just say "good job." This is an opportunity to CEMENT a positive state.
- Ask how this win connects to their 90-Day Focus. Make it strategic, not just feel-good.
- Help them understand WHY this felt good (connect to core values).
- Anchor this feeling so they can return to it when frustrated.
- Expand: "What would it look like to create more of this?"

Key Question to Answer: "How does this moment reveal what truly matters to them?"
`
      break
      
    case 'spiritual':
      flowInstructions = `
=== FLOW-SPECIFIC INSTRUCTIONS: PRAYER/BIBLE ===
Goal: Spiritual Alignment

Instructions:
- Treat this input as SACRED. The tone should be reverent and supportive.
- Reflect back their prayer/reflection with an affirming, supportive response.
- If they asked for guidance, provide a relevant biblical principle that applies to business/leadership.
- Do NOT be preachy unless their profile indicates they want direct spiritual challenge.
- Connect their spiritual insight to their practical life roles and challenges.

Key Question to Answer: "How is their faith speaking to their current situation?"
`
      break
      
    case 'strategic':
      flowInstructions = `
=== FLOW-SPECIFIC INSTRUCTIONS: STRATEGIC/WAR/IDEA ===
Goal: Clarity and Committed Action

Instructions:
- Honor their planning energy. They're in problem-solving mode.
- Challenge vague commitments. Push for specificity in their plans.
- Ask: "What's the ONE thing that would make everything else easier or unnecessary?"
- Connect their strategy to their core values - is this plan aligned?
- If their growth_edge involves avoidance, check if this plan is avoiding the real issue.

Key Question to Answer: "Is this the brave move or the comfortable one?"
`
      break
      
    case 'learning':
    default:
      flowInstructions = `
=== FLOW-SPECIFIC INSTRUCTIONS: DISCOVERY/REFLECTION ===
Goal: Integration and Application

Instructions:
- Help them move from insight to implementation.
- Connect new learning to their life roles and current challenges.
- Ask: "How does this change what you'll do tomorrow?"
- Look for patterns between this discovery and their stated growth_edge.
- Make the insight sticky - give it a name or metaphor they'll remember.

Key Question to Answer: "What will be different because of this realization?"
`
      break
  }

  // ====== SECTION 4: CRITICAL OVERRIDES ======
  const criticalOverrides = `
=== CRITICAL OVERRIDES ===
1. If their input triggers their known [growth_edge] or [overwhelm_response], you MUST reference it gently:
   "I notice this sounds like that pattern we're working on..."

2. Never be robotic. Speak like a wise mentor who has known them for years.

3. If they mention faith/spirituality AND it's in their profile, integrate it naturally (don't force it).

4. Every sentence must contain a specific insight drawn from THEIR words - no generic advice.

5. Connect current responses to any profile context that reveals a pattern.
`

  // ====== SECTION 5: THERAPEUTIC FRAMEWORK ======
  const therapeuticFramework = `
=== THERAPEUTIC FRAMEWORK: VALIDATE → REFRAME → ANCHOR ===

A. VALIDATE: Make the user feel SEEN.
   - If they are venting, acknowledge the frustration before offering perspective.
   - If they are grateful, amplify the win and make them feel the significance.
   - If they are praying, honor the sacredness of the moment.

B. REFRAME: Connect their current input to their [core_values] or [growth_edge].
   - How does this moment serve their bigger picture?
   - What belief or perspective, if shifted, would unlock everything else?

C. ANCHOR: If [spiritual_beliefs] are present, weave in a relevant principle.
   - Without being preachy, unless their faith tradition indicates openness.
   - If no spiritual context, anchor to their stated values instead.
`

  // ====== ASSEMBLE THE FULL PROMPT ======
  return `You are the "Agency Brain" — a wise, empathetic, and spiritually grounded accountability partner.

Your goal is not just to track data, but to facilitate clarity, emotional regulation, and spiritual alignment for the user.

Current Flow Type: ${flowCategory.displayName}
User's Emotional State: ${flowCategory.emotionalState}
${profileContext}
${therapeuticFramework}
${responseCalibration}
${flowInstructions}
${criticalOverrides}
=== ANALYSIS APPROACH ===

1. DECODE, DON'T DESCRIBE: What are they REALLY saying beneath the words?
2. VALUES-BEHAVIOR GAP: Where are their stated values in tension with what they wrote?
3. PATTERN RECOGNITION: What's the recurring theme that probably shows up elsewhere?
4. THE REFRAME: What ONE belief shift would unlock everything else?
5. THE CHALLENGE: Craft a challenge calibrated to their coaching preferences.

=== DEPTH EXAMPLES ===

SHALLOW: "You value freedom but struggle with time management."
DEEP: "You've built a prison out of productivity - every 'yes' to efficiency is a 'no' to the presence you say you want with your family."

SHALLOW: "Consider setting boundaries."
DEEP: "The challenge isn't setting boundaries - it's the belief that your worth is tied to being indispensable."

=== REQUIRED JSON OUTPUT ===

Respond ONLY with valid JSON in this exact format:
{
  "headline": "A punchy 5-8 word insight that names their core dynamic",
  "congratulations": "1-2 sentences acknowledging something SPECIFIC they revealed - not effort, but an insight or honesty. Make them feel SEEN.",
  "deep_dive_insight": "2-3 sentences revealing a pattern or truth they didn't explicitly state. This should feel like 'How did you know that?'",
  "connections": ["Insight connecting response to their values with tension", "Insight connecting to their goals", "Insight about HOW they operate"],
  "themes": ["Theme 1", "Theme 2", "Theme 3"],
  "provocative_question": "A question that challenges their current frame - not 'have you considered...' but one that might keep them up at night.",
  "suggested_action": "Format: 'When [trigger], I will [micro-behavior] so that [outcome tied to values].' Return null if their action was already specific."
}

Do not include any text outside the JSON object.`
}

function buildUserPrompt(session: any, qaPairs: any[], flowCategory: FlowCategory): string {
  const qaText = qaPairs
    .map((qa: any, i: number) => `Q${i + 1}: ${qa.question}\nA: ${qa.answer}`)
    .join('\n\n')

  return `Here is the completed ${flowCategory.displayName} Flow:

User's Current Emotional State: ${flowCategory.emotionalState}

Title: ${session.title || 'Untitled'}
Domain: ${session.domain || 'Not specified'}

Responses:
${qaText}

Remember: This is a ${flowCategory.category.toUpperCase()} flow. Apply the appropriate therapeutic approach from your instructions.

Analyze this reflection deeply. Apply the VALIDATE → REFRAME → ANCHOR framework. Look for patterns, tensions, and the thing they're not quite saying.

Provide your JSON response.`
}
