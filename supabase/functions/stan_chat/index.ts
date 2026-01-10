import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-staff-session',
};

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

const STAN_SYSTEM_PROMPT = `You are Stan, the friendly AI assistant for Agency Brain - an insurance agency management platform.

PERSONALITY:
- Warm, helpful, and encouraging - like a knowledgeable coworker
- Keep responses concise (2-4 sentences unless more detail is genuinely needed)
- Use "you" and "your" to be personal
- Be empathetic when users seem frustrated
- Celebrate when users accomplish things or express gratitude

CONTEXT AWARENESS:
- You know what page the user is currently on
- You know their role (owner, key_employee, manager, staff)
- You know their membership tier (1:1 Coaching, Boardroom, Call Scoring)
- You know which portal they're in (Brain Portal or Staff Portal)

RESPONSE GUIDELINES:
- If a feature isn't available to their role/tier, explain WHY kindly and suggest alternatives
- Point users to the right page/tab when relevant (e.g., "Head over to Agency → Team tab")
- If you're not sure about something, say so and suggest emailing info@standardplaybook.com
- Never make up features that don't exist
- Use the FAQ knowledge provided as your source of truth
- Don't quote FAQs verbatim - rephrase naturally in conversation
- Keep insurance industry context in mind - these are agency owners and their staff

FORMATTING:
- Use **bold** for important navigation items or feature names
- Keep responses focused and actionable
- Don't use bullet lists unless listing multiple distinct options
- End with an offer to help more if the topic warrants it`;

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { 
      message, 
      conversation_history = [],
      context 
    } = await req.json();

    const {
      portal = 'brain',
      current_page = '/dashboard',
      user_role = 'owner',
      membership_tier = 'all',
      user_id = null,
      staff_user_id = null,
      agency_id = null
    } = context || {};

    console.log('Stan chat request:', { message, portal, current_page, user_role, membership_tier });

    // ============ STEP 1: Search relevant FAQs ============
    
    // Extract keywords from the user's message (simple approach)
    const messageWords = message.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((word: string) => word.length > 2);

    // Determine likely category from current page
    const pageToCategory: Record<string, string> = {
      '/dashboard': 'dashboard',
      '/submit': 'submit',
      '/metrics': 'metrics',
      '/agency': 'agency',
      '/training': 'training',
      '/bonus-grid': 'bonus-grid',
      '/snapshot-planner': 'snapshot-planner',
      '/roleplaybot': 'roleplay',
      '/call-scoring': 'call-scoring',
      '/exchange': 'exchange',
      '/settings': 'settings',
      '/account': 'settings',
      '/staff/dashboard': 'staff-portal',
      '/staff/training': 'training',
      '/staff/call-scoring': 'call-scoring',
    };

    const currentCategory = Object.entries(pageToCategory)
      .find(([route]) => current_page.startsWith(route))?.[1] || 'general';

    // Build FAQ search query
    // Search by keywords OR by category relevance
    const { data: relevantFaqs, error: faqError } = await supabase
      .from('chatbot_faqs')
      .select('question, answer, category, keywords, applies_to_roles, applies_to_tiers')
      .eq('is_active', true)
      .or(`category.eq.${currentCategory},category.eq.general,category.eq.troubleshooting`)
      .limit(20);

    if (faqError) {
      console.error('FAQ search error:', faqError);
    }

    // Score and rank FAQs by relevance
    const scoredFaqs = (relevantFaqs || []).map(faq => {
      let score = 0;
      
      // Keyword matching
      const faqKeywords = faq.keywords || [];
      const faqQuestion = faq.question.toLowerCase();
      const faqAnswer = faq.answer.toLowerCase();
      
      for (const word of messageWords) {
        if (faqKeywords.some((k: string) => k.toLowerCase().includes(word))) score += 3;
        if (faqQuestion.includes(word)) score += 2;
        if (faqAnswer.includes(word)) score += 1;
      }
      
      // Category bonus
      if (faq.category === currentCategory) score += 2;
      
      // Role/tier relevance
      const roles = faq.applies_to_roles || [];
      const tiers = faq.applies_to_tiers || [];
      if (roles.includes(user_role) || roles.includes('admin')) score += 1;
      if (tiers.includes(membership_tier) || tiers.includes('all')) score += 1;
      
      return { ...faq, score };
    })
    .filter(faq => faq.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

    console.log('Relevant FAQs found:', scoredFaqs.length);

    // ============ STEP 2: Build context for OpenAI ============
    
    const faqContext = scoredFaqs.length > 0
      ? `\n\nRELEVANT KNOWLEDGE BASE ENTRIES:\n${scoredFaqs.map((faq, i) => 
          `${i + 1}. Q: ${faq.question}\n   A: ${faq.answer}\n   Category: ${faq.category}`
        ).join('\n\n')}`
      : '\n\nNo directly relevant FAQs found - use general knowledge about Agency Brain.';

    const userContext = `
USER CONTEXT:
- Portal: ${portal === 'staff' ? 'Staff Portal' : 'Brain Portal (Main App)'}
- Current Page: ${current_page}
- Role: ${user_role}
- Membership Tier: ${membership_tier}`;

    // Build messages array for OpenAI
    const messages: any[] = [
      { role: 'system', content: STAN_SYSTEM_PROMPT + userContext + faqContext }
    ];

    // Add conversation history (last 6 messages max)
    const recentHistory = conversation_history.slice(-6);
    for (const msg of recentHistory) {
      messages.push({
        role: msg.role === 'stan' ? 'assistant' : 'user',
        content: msg.content
      });
    }

    // Add current message
    messages.push({ role: 'user', content: message });

    // ============ STEP 3: Call OpenAI ============
    
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
    const stanResponse = openaiData.choices[0]?.message?.content || 
      "I'm having trouble thinking right now. Please try again or email info@standardplaybook.com for help!";

    console.log('Stan response generated successfully');

    // ============ STEP 4: Save conversation (optional) ============
    
    if (agency_id && (user_id || staff_user_id)) {
      try {
        // Check for existing conversation today
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
          // Update existing conversation
          await supabase
            .from('chatbot_conversations')
            .update({ 
              messages: newMessages,
              current_page,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingConvo.id);
        } else {
          // Create new conversation
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
        // Don't fail the response if save fails
      }
    }

    return new Response(
      JSON.stringify({ 
        response: stanResponse,
        faqs_used: scoredFaqs.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Stan chat error:', error);
    return new Response(
      JSON.stringify({ 
        response: "I'm having a moment! Please try again, or reach out to info@standardplaybook.com if this keeps happening.",
        error: error.message 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  }
});
