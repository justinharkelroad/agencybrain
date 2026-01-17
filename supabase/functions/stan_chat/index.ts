import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-staff-session',
};

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

const STAN_SYSTEM_PROMPT = `You are Stan, the friendly AI assistant for Agency Brain - an insurance agency management platform.

PERSONALITY:
- Warm, helpful, and encouraging
- Keep responses concise (2-4 sentences unless more detail is genuinely needed)
- Use "you" and "your" to be personal

CRITICAL RULES:

1. YOUR KNOWLEDGE BASE IS YOUR ONLY SOURCE
   - You have been given a comprehensive knowledge document about Agency Brain
   - Find the section matching the user's current page FIRST
   - Use ONLY information from this document

2. ROUTE-BASED ANSWERS
   - The user's current page route is provided (e.g., /flows, /cancel-audit)
   - Find that exact section in the knowledge base
   - Answer based on THAT page's documentation

3. DISAMBIGUATION
   - Words like "score" and "saved" mean DIFFERENT things on different pages
   - On /flows: "score" = Flow engagement progress (participation)
   - On /call-scoring: "score" = Call score (0-100 skill rating)
   - On /core4: "score" = Daily habits completed (0-4)
   - On /cancel-audit: "saved" = Premium dollars retained from at-risk policies
   - ALWAYS use the current page to determine meaning

4. NEVER GUESS
   - If something isn't in the knowledge base, say: "I don't have specific information about that yet. Can you describe what you're seeing, or email info@standardplaybook.com for help!"
   - DO NOT invent features, metrics, or UI elements

5. TIER RESTRICTIONS
   - Boardroom users CANNOT access: Bonus Grid, Snapshot Planner, Roleplay Bot, Theta Talk Track, Qualitative sections
   - If they ask about these, explain they are 1:1 Coaching exclusive features

RESPONSE FORMAT:
- Use **bold** for feature names and navigation paths
- Keep answers focused on the current page context
- Offer to help with related features when appropriate`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { message, conversation_history = [], context } = await req.json();
    const {
      portal = 'brain',
      current_page = '/dashboard',
      user_role = 'owner',
      membership_tier = 'all',
      user_id = null,
      staff_user_id = null,
      agency_id = null
    } = context || {};

    console.log('Stan request:', { message, portal, current_page, membership_tier });

    // ============ LOAD KNOWLEDGE BASE ============
    const { data: knowledgeBase, error: kbError } = await supabase
      .from('chatbot_knowledge_base')
      .select('content')
      .eq('is_active', true)
      .single();

    if (kbError || !knowledgeBase) {
      console.error('Failed to load knowledge base:', kbError);
      throw new Error('Knowledge base not available');
    }

    console.log('Knowledge base loaded, length:', knowledgeBase.content.length);

    // ============ BUILD CONTEXT ============
    const userContext = `
CURRENT CONTEXT:
- User is on page: ${current_page}
- Portal: ${portal === 'staff' ? 'Staff Portal' : 'Brain Portal'}
- User role: ${user_role}
- Membership tier: ${membership_tier}

IMPORTANT: Find the section for "${current_page}" in the knowledge base and answer based on THAT page's documentation. If the user asks about "score" or "saved", the meaning depends on which page they're on!`;

    // Tier warning for Boardroom users
    const tierWarning = membership_tier === 'Boardroom' && 
      ['bonus', 'grid', 'snapshot', 'roleplay', 'qualitative', 'theta'].some(k => message.toLowerCase().includes(k))
      ? '\n\n⚠️ IMPORTANT: This user is on Boardroom tier. They CANNOT access Bonus Grid, Snapshot Planner, Roleplay Bot, Theta Talk Track, or Qualitative sections. These are 1:1 Coaching exclusive features.'
      : '';

    // ============ CALL OPENAI ============
    const messages: any[] = [
      { 
        role: 'system', 
        content: STAN_SYSTEM_PROMPT + userContext + tierWarning + '\n\n--- KNOWLEDGE BASE ---\n\n' + knowledgeBase.content
      }
    ];

    // Add conversation history (last 6 messages)
    for (const msg of conversation_history.slice(-6)) {
      messages.push({
        role: msg.role === 'stan' ? 'assistant' : 'user',
        content: msg.content
      });
    }

    messages.push({ role: 'user', content: message });

    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('OpenAI error:', errorText);
      throw new Error(`OpenAI API error: ${openaiResponse.status}`);
    }

    const openaiData = await openaiResponse.json();
    const stanResponse = openaiData.choices?.[0]?.message?.content || 
      "I'm having trouble right now. Please try again or email info@standardplaybook.com for help!";

    console.log('Stan response generated successfully');

    // ============ SAVE CONVERSATION ============
    if (agency_id && (user_id || staff_user_id)) {
      try {
        const today = new Date().toISOString().split('T')[0];
        const { data: existingConvo } = await supabase
          .from('chatbot_conversations')
          .select('id, messages')
          .eq(user_id ? 'user_id' : 'staff_user_id', user_id || staff_user_id)
          .gte('created_at', today)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        const newMessages = [
          ...conversation_history,
          { role: 'user', content: message, timestamp: new Date().toISOString() },
          { role: 'stan', content: stanResponse, timestamp: new Date().toISOString() }
        ];

        if (existingConvo) {
          await supabase
            .from('chatbot_conversations')
            .update({ 
              messages: newMessages,
              current_page,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingConvo.id);
        } else {
          await supabase
            .from('chatbot_conversations')
            .insert({
              user_id: user_id || null,
              staff_user_id: staff_user_id || null,
              agency_id,
              portal,
              messages: newMessages,
              current_page
            });
        }
      } catch (saveError) {
        console.error('Error saving conversation:', saveError);
        // Don't fail the request if save fails
      }
    }

    return new Response(
      JSON.stringify({ 
        response: stanResponse,
        knowledge_base_loaded: true
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Stan chat error:', error);
    return new Response(
      JSON.stringify({ 
        response: "I'm having a moment! Please try again, or reach out to info@standardplaybook.com if this keeps happening.",
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  }
});
